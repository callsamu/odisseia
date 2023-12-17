import { PageBodyStyles, PageStyles, TextStyles } from "./styles";

export function clear(str: string): string {
	return str.
		trim().
		split('\n').
		map(line => line.trim()).
		join(";");
}

export function fontSizeInPx(style: TextStyles): number {
	return style.font.size / 72 * 96;
}

export function lineHeightInPx(style: TextStyles): number {
	return fontSizeInPx(style) * style.lineHeight;
}

export function bodyWidthInCm(page: PageStyles, body: PageBodyStyles): number {
	return page.width - body.marginLeft - body.marginRight;
}

export function bodyHeightInCm(page: PageStyles, body: PageBodyStyles): number {
	return page.height - body.marginTop - body.marginBottom;
}

export function textCSS(style: TextStyles): string {
	return clear(`
		line-height: ${style.lineHeight}
		font-size: ${style.font.size}pt
		font-weight: ${style.font.weight}
		font-family: ${style.font.family}
		text-align: ${style.textAlign}
		text-transform: ${style.transform}
		padding-bottom: ${style.spacing * style.lineHeight}em
	`);
}
