import * as Blockly from 'blockly';

export const FALLBACK_RENDERER = 'zelos';

function buildRenderer() {
  const { ConstantProvider, Renderer } = Blockly.zelos;

  class CodelabConstants extends ConstantProvider {
    constructor() {
      super();
      const g = this.GRID_UNIT;
      this.CORNER_RADIUS = 14;                      
      this.NOTCH_WIDTH = 10 * g;
      this.NOTCH_HEIGHT = 9;
      this.NOTCH_OFFSET_LEFT = 5 * g;
      this.STATEMENT_INPUT_NOTCH_OFFSET = this.NOTCH_OFFSET_LEFT;
      this.MIN_BLOCK_HEIGHT = 11 * g;
      this.TOP_ROW_MIN_HEIGHT = this.CORNER_RADIUS;
      this.BOTTOM_ROW_MIN_HEIGHT = this.CORNER_RADIUS;
      this.STATEMENT_BOTTOM_SPACER = -this.NOTCH_HEIGHT;
      this.FIELD_BORDER_RECT_RADIUS = 16;
      this.FIELD_DROPDOWN_SVG_ARROW = false;
      this.FIELD_TEXT_FONTSIZE = 11;
      this.FIELD_TEXT_FONTWEIGHT = '600';
      this.FIELD_TEXT_FONTFAMILY = "'Be Vietnam Pro','Segoe UI',system-ui,sans-serif";
    }

    init() {
      super.init();
      const w = this.NOTCH_WIDTH;
      this.FLAT_TAIL = { ...this.NOTCH, height: 0, pathLeft: `h ${w}`, pathRight: `h ${-w}` };
    }

    makeNotch() {
      const base = super.makeNotch();
      const w = this.NOTCH_WIDTH; const h = -this.NOTCH_HEIGHT;
      const f = (n) => Math.round(n * 100) / 100;
      const half = (d) => `c ${f(d * 0.12 * w)} 0 ${f(d * 0.12 * w)} ${h} ${f(d * 0.3 * w)} ${h} h ${f(d * 0.4 * w)} c ${f(d * 0.18 * w)} 0 ${f(d * 0.18 * w)} ${-h} ${f(d * 0.3 * w)} ${-h}`;
      return { ...base, pathLeft: half(1), pathRight: half(-1) };
    }

    shapeFor(connection) {
      if (connection.type === Blockly.ConnectionType.NEXT_STATEMENT) {
        const block = connection.getSourceBlock();
        if (block && connection === block.nextConnection && !connection.isConnected()) return this.FLAT_TAIL;
      }
      const shape = super.shapeFor(connection);
      return shape === this.ROUNDED ? this.SQUARED : shape;
    }
  }

  class CodelabRenderer extends Renderer {
    makeConstants_() { return new CodelabConstants(); }
  }

  Blockly.blockRendering.register('codelab', CodelabRenderer);
  return 'codelab';
}

export const RENDERER = (() => {
  try {
    return buildRenderer();
  } catch (error) {
    if (/already/i.test(String(error?.message))) return 'codelab'; // nạp lại nóng (HMR)
    console.warn('Không tạo được bộ vẽ khối "codelab", dùng zelos mặc định.', error);
    return FALLBACK_RENDERER;
  }
})();
