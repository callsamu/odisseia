import { Norm } from "./Norm";

export function ABNT(scale: number = 1): Norm {
	return {
		page: {
			width: 21 * scale,
			height: 29.7 * scale,
		},
		pageBody: {
			marginLeft: 3 * scale,
			marginRight: 2 * scale,
			marginTop: 3 * scale,
			marginBottom: 2 * scale,
		},
		title: {
			lineHeight: 1.5,
			textAlign: "justify",
			transform: "uppercase",
			spacing: 1,
			ident: 0,
			font: {
				size: 14 * scale,
				weight: 'bold',
				family: 'Times New Roman',
			},
		},
		paragraph: {
			lineHeight: 1.5,
			textAlign: "justify",
			spacing: 1,
			transform: "none",
			ident: 0,
			font: {
				size: 12 * scale,
				weight: 'normal',
				family: 'Times New Roman',
			},
		},
		citation: {
			lineHeight: 1.5,
			textAlign: "justify",
			spacing: 1,
			transform: "none",
			ident: 4 * scale,
			font: {
				size: 10 * scale,
				weight: 'normal',
				family: 'Times New Roman',
			},
		},
	};
};
