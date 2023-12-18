import { Norm } from "../norms/Norm";
import { Node } from "@tiptap/pm/model";
import { TextStyles } from "../norms/styles";
import { Title } from "./Title";
import { NormParagraph } from "./NormParagraph";
import { Citation } from "./Citation";

export function textStyle(node: Node, norm: Norm): TextStyles {
	switch (node.type.name) {
		case Title.name: {
			return norm.title;
		}
		case NormParagraph.name: {
			return norm.paragraph;
		}
		case Citation.name: {
			return norm.citation;
		}
		default: {
			throw new Error(`Unknown text content node: ${node.type.name}`);
		}
	}
}
