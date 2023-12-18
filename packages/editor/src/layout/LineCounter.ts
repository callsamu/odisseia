import { Norm } from "../norms/Norm";
import { Node } from "@tiptap/pm/model";
import { fontSizeInPx } from "../norms/utils";
import { textStyle } from "../nodes";

export interface LineData {
	position: number;
	size: number;
}

export class LineCounter {
	constructor(
		private norm: Norm,
		private measurer: TextMeasurer,
		private bounds: DOMRect,
	) {}

	lines(node: Node): LineData[] {
		const text = node.textContent;
		if (text.length === 0) return [{
			size: 0,
			position: 0,
		}];

		let cursor = 0;
		let prevLine = 0;
		let lineWidth = 0;
		const lines: LineData[] = [];

		const style = textStyle(node, this.norm);
		if (!style) throw new Error("text style not found");

		const size = fontSizeInPx(style);

		const font = `${style.font.weight} ${size}px ${style.font.family}`;
		this.measurer.setFont(font);

		const bound = this.bounds.width - style.ident;

		const blank = this.measurer.metrics(" ");

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			if (char === " " || i === text.length - 1) {
				const word = text.slice(cursor, i + 1);

				let width!: number;
				if (word === " ") {
					width = blank.width;
				} else {
					const metrics = this.measurer.metrics(word);
					width = metrics.width;
				}
				
				if (lineWidth + width > bound) {
					lines.push({ 
						position: prevLine, 
						size: cursor - prevLine 
					});
					lineWidth = width;
					prevLine = cursor;
				} else {
					lineWidth += width;
				}

				if (i === text.length - 1) {
					lines.push({ 
						position: prevLine, 
						size: i + 1 - prevLine 
					});
				}

				cursor = i + 1;
			}
		}

		return lines;
	}
}
