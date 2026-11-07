import * as Blockly from 'blockly';

export const FALLBACK_RENDERER = 'zelos';

Blockly.FieldDropdown.ARROW_CHAR = '';
{
  const proto = Blockly.FieldDropdown.prototype;
  const createTextArrow = proto.createTextArrow_;
  if (typeof createTextArrow === 'function') {
    proto.createTextArrow_ = function patchedCreateTextArrow() {
      createTextArrow.call(this);
      if (this.arrow) this.arrow.textContent = '';
    };
  }
}


{
  const proto = Blockly.Field.prototype;
  const original = proto.positionTextElement_;
  if (typeof original === 'function') {
    proto.positionTextElement_ = function centeredPositionTextElement(xOffset, contentWidth) {
      original.call(this, xOffset, contentWidth);
      const block = this.getSourceBlock && this.getSourceBlock();
      if (!this.textElement_ || !this.size_ || (block && block.RTL)) return;
      const x = (this.size_.width - contentWidth) / 2;
      if (Number.isFinite(x) && x > xOffset) this.textElement_.setAttribute('x', String(x));
    };
  }
}

function buildRenderer() {
  const { ConstantProvider, Renderer } = Blockly.zelos;

  class CodelabConstants extends ConstantProvider {
    constructor() {
      super();
      const g = this.GRID_UNIT;
      this.CORNER_RADIUS = 9;
      this.NOTCH_WIDTH = 10 * g;
      this.NOTCH_HEIGHT = 9;
      this.NOTCH_OFFSET_LEFT = 5 * g;
      this.STATEMENT_INPUT_NOTCH_OFFSET = this.NOTCH_OFFSET_LEFT;
      this.MIN_BLOCK_HEIGHT = 9 * g;
      this.TOP_ROW_MIN_HEIGHT = this.CORNER_RADIUS;
      this.BOTTOM_ROW_MIN_HEIGHT = this.CORNER_RADIUS;
      this.STATEMENT_BOTTOM_SPACER = -this.NOTCH_HEIGHT;
      this.STATEMENT_INPUT_PADDING_LEFT = 2 * g;
      this.TOP_ROW_PRECEDES_STATEMENT_MIN_HEIGHT = this.CORNER_RADIUS;
      this.BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT = this.CORNER_RADIUS + 2;
      this.FIELD_BORDER_RECT_RADIUS = 16;
      this.FIELD_DROPDOWN_SVG_ARROW = false;
      this.FIELD_TEXT_FONTSIZE = 11;
      this.FIELD_TEXT_FONTWEIGHT = '600';
      this.FIELD_TEXT_FONTFAMILY = "'Be Vietnam Pro','Segoe UI',system-ui,sans-serif";
    }

    init() {
      super.init();
      this.PLUG_ROUND = this.makePlug(false, this.SQUARED);
      this.PLUG_HEX = this.makePlug(true, this.SQUARED);
    }

    makePlug(pointed, bodyShape) {
      const W = pointed ? 11 : 10;
      const f = (n) => Math.round(n * 100) / 100;
      const dims = (h) => {
        const T = Math.max(12, Math.min(22, h * 0.55));
        return { T, a: (h - T) / 2, s: T * 0.3 };
      };
      const up = (h) => {
        const { T, a, s } = dims(h);
        if (pointed) {
          return `v ${f(-a)} l ${f(-W)} ${f(-s)} v ${f(-(T - 2 * s))} l ${f(W)} ${f(-s)} v ${f(-a)}`;
        }
        return `v ${f(-a)} c ${f(-0.6 * W)} 0 ${f(-W)} ${f(-0.4 * s)} ${f(-W)} ${f(-s)}`
          + ` v ${f(-(T - 2 * s))} c 0 ${f(-0.6 * s)} ${f(0.4 * W)} ${f(-s)} ${f(W)} ${f(-s)} v ${f(-a)}`;
      };
      const down = (h) => {
        const { T, a, s } = dims(h);
        if (pointed) {
          return `v ${f(a)} l ${f(-W)} ${f(s)} v ${f(T - 2 * s)} l ${f(W)} ${f(s)} v ${f(a)}`;
        }
        return `v ${f(a)} c ${f(-0.6 * W)} 0 ${f(-W)} ${f(0.4 * s)} ${f(-W)} ${f(s)}`
          + ` v ${f(T - 2 * s)} c 0 ${f(0.6 * s)} ${f(0.4 * W)} ${f(s)} ${f(W)} ${f(s)} v ${f(a)}`;
      };
      return {
        type: bodyShape.type,
        isDynamic: true,
        width: () => W,
        height: (h) => h,
        connectionOffsetY: (h) => h / 2,
        connectionOffsetX: (w) => -w,
        pathUp: up,
        pathDown: down,
        pathRightDown: (h) => bodyShape.pathRightDown(h),
        pathRightUp: (h) => bodyShape.pathRightUp(h),
      };
    }

    makeNotch() {
      const base = super.makeNotch();
      const w = this.NOTCH_WIDTH; const h = -this.NOTCH_HEIGHT;
      const f = (n) => Math.round(n * 100) / 100;
      const half = (d) => `c ${f(d * 0.12 * w)} 0 ${f(d * 0.12 * w)} ${h} ${f(d * 0.3 * w)} ${h} h ${f(d * 0.4 * w)} c ${f(d * 0.18 * w)} 0 ${f(d * 0.18 * w)} ${-h} ${f(d * 0.3 * w)} ${-h}`;
      return { ...base, pathLeft: half(1), pathRight: half(-1) };
    }

    shapeFor(connection) {
      const shape = super.shapeFor(connection);
      if (shape === this.HEXAGONAL) return this.PLUG_HEX;
      if (shape === this.ROUNDED || shape === this.SQUARED) return this.PLUG_ROUND;
      return shape;
    }
  }

  const { RenderInfo } = Blockly.zelos;
  const { Types } = Blockly.blockRendering;
  const H_PAD = 12;
  const EDGE_PADDING = H_PAD;
  const INPUT_LEFT_PADDING = H_PAD;
  const NOTCH_CLEARANCE = 5;
  const BODY_PADDING_EXTRA = 4;

  const pathBottom = (block) => {
    const path = block?.pathObject?.svgPath;
    if (!path || typeof path.getBBox !== 'function') return null;
    try {
      const box = path.getBBox();
      return box.height > 0 ? box.y + box.height : null;
    } catch {
      return null;
    }
  };
  const stackPathHeight = (first) => {
    let last = first;
    while (last.getNextBlock()) last = last.getNextBlock();
    const bottom = pathBottom(last);
    if (bottom === null) return null;
    const offset = last === first ? 0 : last.getRelativeToSurfaceXY().y - first.getRelativeToSurfaceXY().y;
    return offset + bottom;
  };

  class CodelabRenderInfo extends RenderInfo {
    getSpacerRowHeight_(prev, next) {
      const base = super.getSpacerRowHeight_(prev, next);
      try {
        const afterTop = !!prev && (prev.type & Types.TOP_ROW) !== 0;
        const hasSocket = !!prev && !prev.hasStatement && (prev.elements || []).some((e) => Types.isInlineInput(e));
        if (next?.hasStatement && !afterTop && hasSocket) {
          return Math.max(base, this.constants_.NOTCH_HEIGHT + NOTCH_CLEARANCE + BODY_PADDING_EXTRA);
        }
        const nextHasSocket = !!next && !next.hasStatement && (next.elements || []).some((e) => Types.isInlineInput(e));
        const bottomSpace = this.constants_.NOTCH_HEIGHT + NOTCH_CLEARANCE + BODY_PADDING_EXTRA;
        const balance = Math.max(0, bottomSpace - (this.constants_.TOP_ROW_MIN_HEIGHT || 0));
        if (afterTop && nextHasSocket && !this.outputConnection) {
          return Math.max(base, balance);
        }
        const nextIsBottom = !!next && (next.type & Types.BOTTOM_ROW) !== 0;
        if (nextIsBottom && hasSocket && !this.outputConnection) {
          return Math.max(base, balance);
        }
      } catch (error) {
        console.warn('codelab: không chỉnh được khoảng cách hàng.', error);
      }
      return base;
    }

    computeBounds_() {
      super.computeBounds_();
      try {
        this.rows.forEach((row) => {
          if (!row.hasStatement) return;
          const input = row.getLastInput();
          const child = input?.connectedBlock;
          if (!child) return;
          const fit = stackPathHeight(child);
          if (fit === null) return;
          const min = 2 * (this.constants_.INSIDE_CORNERS?.height || 0) + 1;
          const target = Math.max(min, Math.round(fit * 100) / 100);
          if (Math.abs(row.height - target) < 40) row.height = target;
        });
      } catch (error) {
        console.warn('codelab: không khớp được miệng chữ C với khối con.', error);
      }
    }

    getInRowSpacing_(prev, next) {
      const base = super.getInRowSpacing_(prev, next);
      if (!this.outputConnection) {
        const isContent = (e) => !!e && (Types.isField(e) || Types.isIcon(e) || Types.isInlineInput(e));
        if (!prev && isContent(next)) return H_PAD;
        if (prev && !next && isContent(prev)) return H_PAD;
      }
      if (base !== 0 || !this.outputConnection) return base;
      const atRight = !!prev && !next;
      const edge = atRight ? prev : next;
      if (!edge) return base;
      if (Types.isField(edge) || (atRight && this.inputRows.length > 1)) return EDGE_PADDING;
      if (!atRight && Types.isInlineInput(edge)) return INPUT_LEFT_PADDING;
      return base;
    }
  }

  const ALIGN_CENTRE = Blockly.inputs?.Align?.CENTRE ?? 0;
  const origAlign = RenderInfo.prototype.addAlignmentPadding_;
  if (typeof origAlign === 'function') {
    CodelabRenderInfo.prototype.addAlignmentPadding_ = function addAlignmentPadding(row, missingSpace) {
      if (this.outputConnection && !row.hasInlineInput && !row.hasExternalInput && !row.hasStatement) {
        row.align = ALIGN_CENTRE;
      }
      return origAlign.call(this, row, missingSpace);
    };
  }

  class CodelabRenderer extends Renderer {
    makeConstants_() { return new CodelabConstants(); }
    makeRenderInfo_(block) { return new CodelabRenderInfo(this, block); }
  }

  Blockly.blockRendering.register('codelab', CodelabRenderer);
  return 'codelab';
}

export const RENDERER = (() => {
  try {
    return buildRenderer();
  } catch (error) {
    if (/already/i.test(String(error?.message))) return 'codelab';
    console.warn('Không tạo được bộ vẽ khối "codelab", dùng zelos mặc định.', error);
    return FALLBACK_RENDERER;
  }
})();
