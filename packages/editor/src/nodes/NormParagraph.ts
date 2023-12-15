import { Attrs } from '@tiptap/pm/model';
import { Paragraph } from '@tiptap/extension-paragraph';
import { ParagraphStyles } from '../norms/styles';
import { clear } from '../norms/utils';
import { DefaultNorm } from '../norms/DefaultNorm';
import { Norm } from '../norms/Norm';

interface NormParagraphOptions {
	norm: Norm;
};

export const NormParagraph = Paragraph.extend<NormParagraphOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			norm: DefaultNorm,
		};
	},

	addAttributes() {
		return {
			style: {
				default: this.options.norm.paragraph,
				parseHTML: () => this.options.norm.paragraph,
				renderHTML: (attrs: Attrs) => {
					const style: ParagraphStyles = attrs.style;
					const styleString = clear(`
						line-height: ${style.lineHeight}
						font-size: ${style.font.size}pt
						font-weight: ${style.font.weight}
						font-family: ${style.font.family}
					`);
					return { style: styleString };
				}
			},
		};
	}
})


