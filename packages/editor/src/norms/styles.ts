export interface PageStyles {
	// Everything in cm
	width: number;
	height: number;
}

export interface PageBodyStyles {
	// Everything in cm
	marginLeft: number;
	marginRight: number;
	marginTop: number;
	marginBottom: number;
}

export interface Font {
	family: string;
	weight: string;
	size: number; // in PTs
}

export interface TextStyles {
	font: Font;
	lineHeight: number;
	textAlign: string;
	transform?: string;
}

export interface ParagraphStyles extends TextStyles {}
