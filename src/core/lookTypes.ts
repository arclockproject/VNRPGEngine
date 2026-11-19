// Makes the names in src/content/look/parts.ts valid (and autocompleted) as
// <Button variant="..."> and <Paper variant="...">.
import type look from '@/content/look'

type PartVariants = { [K in keyof typeof look.parts]: true }

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides extends PartVariants {}
}
declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides extends PartVariants {}
}
