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
	lineHeight: number;
	textAlign: string;
	spacing: number; // in em
	ident: number; // in cm
	transform: string;
	font: Font;
}

export interface ParagraphStyles extends TextStyles {}
