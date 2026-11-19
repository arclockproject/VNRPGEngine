// The crafting window: game.crafting.open() or game.crafting.open('campfire').
// Edit freely: it is game content. Recipes: src/content/recipes.ts.
import { Avatar, Button, Stack, Typography } from '@mui/material'
import { defineWindow, type WindowProps } from '@/core/define'
import { game } from '@/core/game'
import { tx, useLang } from '@/core/lang'
import { type CraftProblem, useRecipes } from '@/core/managers/crafting'

export interface CraftingParams {
  /** Where the player is crafting ('campfire'); missing = no station. */
  station?: string
}

const WHY: Record<CraftProblem, string> = {
  unknown: tx('You do not know this recipe.'),
  station: tx('This cannot be made here.'),
  items: tx('Something is missing.'),
  tools: tx('You need the right tool.'),
  money: tx('Not enough money.'),
  full: tx('You cannot carry more of these.'),
}

function Crafting({ params }: WindowProps<CraftingParams | undefined>) {
  const t = useLang()
  const station = params?.station
  const recipes = useRecipes(station)

  if (recipes.length === 0)
    return <Typography color="text.secondary">{t('Nothing can be made here yet.')}</Typography>

  return (
    <Stack spacing={1.5}>
      {recipes.map(({ id, recipe, name, description, icon, needs, tools, problem }) => (
        <Stack key={id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Avatar
            src={icon}
            variant="square"
            sx={{ width: 32, height: 32, imageRendering: 'pixelated', bgcolor: 'transparent' }}
          >
            {name.slice(0, 1)}
          </Avatar>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography>
              {name}
              {(recipe.count ?? 1) > 1 ? ` × ${recipe.count}` : ''}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
            {/* What it takes: "Apple 1/2" turns red-ish (error colour) while something is missing. */}
            <Typography variant="caption">
              {needs.map((need, index) => (
                <Typography
                  key={need.id}
                  component="span"
                  variant="caption"
                  color={need.have >= need.need ? 'text.primary' : 'error'}
                >
                  {index > 0 ? ', ' : ''}
                  {need.name} {need.have}/{need.need}
                </Typography>
              ))}
              {tools.map((tool) => (
                <Typography
                  key={tool.id}
                  component="span"
                  variant="caption"
                  color={tool.have ? 'text.primary' : 'error'}
                >
                  {', '}
                  {t('needs {tool}', { tool: tool.name })}
                </Typography>
              ))}
              {recipe.cost ? `, ${game.money.format(recipe.cost)}` : ''}
            </Typography>
            {/* The reason is always on screen: no hover needed (touch, gamepad). */}
            {problem && (
              <Typography variant="caption" color="text.secondary">
                {t(WHY[problem])}
              </Typography>
            )}
          </Stack>
          <Button
            size="small"
            variant="outlined"
            disabled={problem !== null}
            onClick={() => game.crafting.make(id, { station })}
          >
            {t('Make')}
          </Button>
        </Stack>
      ))}
    </Stack>
  )
}

export default defineWindow<CraftingParams | undefined>({
  title: 'Crafting',
  component: Crafting,
  width: 460,
})
