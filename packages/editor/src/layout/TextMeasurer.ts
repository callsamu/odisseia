export class TextMeasurer {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor() {
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d')!;
	}

	setFont(font: string) {
		this.ctx.font = font;
	}

	metrics(text: string): TextMetrics {
		return this.ctx.measureText(text);
	}
}
