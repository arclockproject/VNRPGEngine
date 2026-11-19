// Buy and sell: game.shops.open('anna') (or game.windows.open('shop', { shop: 'anna' })).
import { Avatar, Button, Stack, Tab, Tabs, Typography } from '@mui/material'
import { type ReactNode, useState } from 'react'
import { defineWindow, type WindowProps } from '@/core/define'
import { game } from '@/core/game'
import { tx, useLang } from '@/core/lang'
import { useMoney } from '@/core/managers/money'
import type { TradeResult } from '@/core/managers/shops'
import type { ItemId, ShopId } from '@/core/registry'
import { useGameStore } from '@/core/stores/game'

const REASON: Record<Exclude<TradeResult, 'ok'>, string> = {
  money: tx('Not enough money'),
  stock: tx('Sold out'),
  full: tx("Can't carry more"),
  missing: tx("You don't have that"),
  refused: tx('Not for sale'),
}

function Row({
  id,
  price,
  extra,
  children,
}: {
  id: ItemId
  price: number
  extra?: string
  children: ReactNode
}) {
  const t = useLang()
  const item = game.items.info(id)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Avatar src={item.icon} variant="square" sx={{ width: 28, height: 28 }} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography>{t(item.name)}</Typography>
        <Typography variant="caption" color="text.secondary">
          {game.money.format(price)}
          {extra ? ` · ${extra}` : ''}
        </Typography>
      </Stack>
      {children}
    </Stack>
  )
}

function Buy({ shop }: { shop: ShopId }) {
  const t = useLang()
  return (
    <Stack spacing={1}>
      {game.shops.list(shop).map(({ id, price, stock }) => {
        const result = game.shops.canBuy(shop, id)
        return (
          <Row
            key={id}
            id={id}
            price={price}
            extra={Number.isFinite(stock) ? t('{count} left', { count: stock }) : undefined}
          >
            <Button
              variant="outlined"
              data-sound="none"
              disabled={result !== 'ok'}
              onClick={() => {
                if (game.shops.buy(shop, id, 1, { notify: true }) === 'ok')
                  game.audio.sfx('sfx/confirm')
              }}
            >
              {result === 'ok' ? t('Buy') : t(REASON[result])}
            </Button>
          </Row>
        )
      })}
    </Stack>
  )
}

function Sell({ shop }: { shop: ShopId }) {
  const t = useLang()
  const list = game.shops.sellable(shop)
  if (list.length === 0)
    return <Typography color="text.secondary">{t('Nothing they would buy.')}</Typography>
  return (
    <Stack spacing={1}>
      {list.map(({ id, count, price }) => (
        <Row key={id} id={id} price={price} extra={`×${count}`}>
          <Button
            variant="outlined"
            data-sound="none"
            onClick={() => {
              if (game.shops.sell(shop, id) === 'ok') game.audio.sfx('sfx/confirm')
            }}
          >
            {t('Sell')}
          </Button>
        </Row>
      ))}
    </Stack>
  )
}

function Shop({ params, close }: WindowProps<{ shop: ShopId }>) {
  const t = useLang()
  const wallet = useMoney()
  useGameStore((s) => s.data.inventory) // re-render after trades (stock, counts)
  useGameStore((s) => s.shops)
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const info = game.shops.info(params.shop)
  const sells = info.buys !== false
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: 'baseline' }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {t(info.name)}
        </Typography>
        <Typography color="warning.main">{game.money.format(wallet)}</Typography>
      </Stack>
      {sells && (
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
          <Tab value="buy" label={t('Buy')} />
          <Tab value="sell" label={t('Sell')} />
        </Tabs>
      )}
      {tab === 'buy' || !sells ? <Buy shop={params.shop} /> : <Sell shop={params.shop} />}
      <Button onClick={close}>{t('Leave')}</Button>
    </Stack>
  )
}

export default defineWindow({ title: 'Shop', component: Shop, width: 440 })
