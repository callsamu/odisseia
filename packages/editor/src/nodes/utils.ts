import { Norm } from "../norms/Norm";
import { Node } from "@tiptap/pm/model";
import { TextStyles } from "../norms/styles";
import { Title } from "./Title";
import { NormParagraph } from "./NormParagraph";

export function textStyle(node: Node, norm: Norm): TextStyles {
	switch (node.type.name) {
		case Title.name: {
			return norm.title;
		}
		case NormParagraph.name: {
			return norm.paragraph;
		}
		default: {
			throw new Error(`Unknown text content node: ${node.type.name}`);
		}
	}
}
