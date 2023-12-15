import { mergeAttributes } from '@tiptap/core';
import { Paragraph } from '@tiptap/extension-paragraph';
import { clear } from '../norms/utils';
import { DefaultNorm } from '../norms/DefaultNorm';
import { Norm } from '../norms/Norm';

interface NormParagraphOptions {
	norm: Norm;
};

export const NormParagraph = Paragraph.extend<NormParagraphOptions>({
	addOptions() {
		return {
			norm: DefaultNorm,
		};
	},

	renderHTML({ HTMLAttributes }) {
		const { paragraph } = this.options.norm;

		const style = { style: clear(`
			line-height: ${paragraph.lineHeight}
			font-size: ${paragraph.font.size}pt
			font-weight: ${paragraph.font.weight}
			font-family: ${paragraph.font.family}
		`)}

		const attrs = mergeAttributes(style, HTMLAttributes);

		return ['p', attrs, 0]
	}
})
