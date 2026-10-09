// Reference badge: square color field and a white footer, in a 142:174 frame.
export function pegiLayout(width: number, height: number) {
  const badgeWidth = Math.min(width, height * 142 / 174)
  const badgeHeight = badgeWidth * 174 / 142
  const border = badgeWidth / 200
  const inset = badgeWidth * 3 / 142
  return {
    width: badgeWidth, height: badgeHeight,
    left: (width - badgeWidth) / 2, top: (height - badgeHeight) / 2,
    border, inset, square: badgeWidth - inset * 2,
    numberSize: badgeWidth * 0.83, footerSize: badgeWidth * 0.135,
  }
}

export function pegiColor(rating: string) {
  return Number(rating) < 12 ? '#99cc33' : Number(rating) < 18 ? '#f59c00' : '#e52322'
}
