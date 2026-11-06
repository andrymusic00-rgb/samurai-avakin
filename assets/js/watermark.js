const WATERMARK = (() => {
  const instances = [];
  let rafId = null;
  let time = 0;
  const SVG_DATA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="none"><defs><style>.cls-1{fill:#f5f1fd}.cls-2{fill:#f0cc90}.cls-3{fill:#d1dcfb}.cls-4{fill:#dfe7fa}.cls-5{fill:#e1c4f5}.cls-6{fill:#e9c0ec}.cls-7{fill:#e5b8eb}.cls-8{fill:#f4e5fd}.cls-9{fill:#f7f6f9}.cls-10{fill:#e6c6f5}.cls-11{fill:#e4bcef}.cls-12{fill:#dcc7f9}.cls-13{fill:#f6f4fa}.cls-14{fill:#e2cdfc}.cls-15{fill:#d4d9fc}.cls-16{fill:#d5cff9}.cls-17{fill:#dbcff9}.cls-18{fill:#f9f8fa}.cls-19{fill:#e7bce9}.cls-20{fill:#cfd8f8}.cls-21{fill:#f6f4fb}.cls-22{fill:#dcbffa}.cls-23{fill:#d9c3fa}.cls-24{fill:#dfcffb}.cls-25{fill:#bec8fa}.cls-26{fill:#dec1f8}.cls-27{fill:#e2baf2}.cls-28{fill:#f5effd}.cls-29{fill:#ddd1fc}.cls-30{fill:#fdfdfd}</style></defs><path class="cls-30" d="M0,877V0h1440v706c-1.15.06-4.29-1.88-3.59-2.99l1.26-1.99c.27-.42-.53-1.26-1.02-1.59l-7.37-.12,3.12-3.38c.6-.65-.39-2.82-1.29-3.01l-6.59-1.36-1.55,3.21c-5.9-.88-11.08-1.2-16.76-.78-5.2-2.14-10.47-3.64-16.27-2.84-6.21.12-13.75-3.34-17.78-7.43-1.84-.55-5.87.19-7.24,1.03l-3.67,1.59-4.98,2.15-6.75-.15c-6.45,2.98-13.49.24-13.49.2l.71-3.63-8.05-2.45c-8.81-4.86-10.97,4.03-21.73,9.36l1.62,7.84,5.76,2.89,3.69-.83-2.74-2.67c-.45-.44,1.04-1.74,1.7-1.86l10.15-.6,1.39,4.21c-4.29,6.45-10.37-.11-12.63,3.47-.59.94-.36,3.34.45,4.98.99,1.99,6.38,1.81,8.36.85l5.57-2.68,2.45-4.93,7.29.28,5.96,4.47c.19,1.32,1.91,3.36,2.79,4.33l-2.28,1.55c-.55.37-.1,1.56.34,3.29l-9.98,3.65-1.39,3.9c-.4,1.14,2.85,3.07,3.89,3.76l11.33,7.46c3.68,2.43,5.62,3.56,10.55,5.62-.76,5.56-5.45,8.94-4.21,15.36.35,1.79,3.26,3.39,4.93,4.75.82,2.13,2.1,3.47,4.5,4.65l6.77,3.33,6.75,2.31c-1.3,3.95-2.97,5.31-5.88,7.36,1,5.57,12.49,8.58,20.44,3.95l2.83-1.65c.6-.35.04-1.86-.59-3.05l-9.18,1.91c.85-4.19,3.77-4.86,7.72-4.72l-2.71-5.67,6.83-3.18,10.46-5.91c.69-.39,3.84.02,4.12.75l1.21,3.1c4.35,1.18,11.9,2.25,15.71-.9l9.03-7.15v60l-10.39-3.79c-3.25-1.16-8.41,1.22-12.43,2.38l1.27,6.34c2.61.56,7.44,2,9.98,1.25l11.57-3.18v37s-13.55,1.64-13.55,1.64c3.2,3.2,4.54,5.31,5.24,8.94l3.04,5.92c-1.4,1.36-2.73,6.35-1.06,7.49l6.34,4.01v16h-107.16c-2.18-4.45-5.03-4.35-9.51-12.24l-2.04-3.6c-10.64,2.38-16.16-4.03-30.95-1.53-1.05.18-3.94-.78-3.92-1.69l.08-3.55-4.51-2.06c-1.24-.57-.93-3.9-.14-6.22l-14.59-7.5c-2.83-1.45-3.37-3.78-3.71-7.32l5.58-1.88-11.89-5.94c1.01-.87,2.51-2.41,3.06-3.26-11.79-2.33-14.51,2.17-20.2-3.4-5.11-5.01-13.97-3.64-20.97-5.1l-11.63-2.43-17.11-2.86c-7.5-4.74-15.73.8-21.14-5.25-2.33-2.61-4.78-1.21-8.05-.59l-7.18,1.31,1.63,8.53-2.47,4.29-2.31,2.12-16.43,1.56c-3.37.32-6.5.63-10.4.35,1.63-7.68,5.51-11.8,12.9-15.58l-6.56-4.18,4.66-7.03,5.03-7.14,7.86-2.6c7.54-2.5,21.07,2.46,27.06-2.87l-8.74.2c.12-1.78.93-4.55,1.46-5.64l1.28-.75c1.52-.89-2.72-3.67-2.69-3.85l.35-2.52c-.17-1.17-.61-4.11.08-5.15s2.53-2.13,3.57-2.94c1.09-2.03,2.39-3.61,4.11-4.16l9.8-3.1,3.57-5.31,16.26-5.55c-.13-.94-1.17-4.07-2.22-4.63-3.6-1.9-10.67-5.74-14.65-5.96l-13.16-.75c-2.45-.14-5.13-.65-7.03-1.17l4.65-3.48,38.75-25.27c18.9-12.32,35.54-26.53,52.2-41.77l26.01-26.01c15.35-15.35,27.78-32.78,39.12-50.64l-1.19-.76-2.73-.78,3.27-.04c.19,0,.24.15.99.99l11.2-18.26c20.7-36.91,33.38-76.88,36.36-119.24v-31.58c-5.17-72.57-38.5-135.68-87.02-188.72l-26.03-26.02c-27.73-27.73-81.32-62.68-117.41-81.74-47.03-24.84-96.21-44.41-147.53-59.35-64.24-18.7-129.99-30.65-196.42-35.58l-15.18-1.13-13.01-.66-11.07-.83h-83.78s-11.07.83-11.07.83l-13.01.66-15.18,1.13c-66.43,4.95-132.18,16.9-196.42,35.57-73.91,21.48-154.06,56.77-216.47,101.58l-8.18,5.88c-23.79,18.66-46.39,37.62-66.81,60.15-26.52,29.27-48.63,61.51-64.53,97.88l-7-3.46-.11,4.26c.9-.4,5.99,1.8,5.42,3.33-8.69,20.97-14.45,42.72-17.93,64.04l-9.6-1.53c.7,5.04,3.63,5.92,7.23,5.46,1.03,2.14,1.19,5.02.9,8.06l-1.04,11.07c-.97,10.36-.61,20.35.13,30.72,3.07,43.41,16.26,84.12,37.87,121.95,18.4,31.76,40.98,60.19,67.45,85.41l1.36,2.9-8.56,2.52c-1.71,2.77-3.89,4.8-7.95,6.15,4.97,4.38,12.95,4.9,18.82.34l1.99,2.93,3-2.65c.58-.51,1.92,1.64,2.62,1.92l7.91,3.21,1.26,3.36c.34.92,3.69,1.23,4.77,1.23l6.67,3.74c1.81,3.56,1.69,7.61-.09,11.16l-.02,4.81,2.14,2.03c.49.47-.11,2.14-.36,3.11l16.34,6.32,2.42,1.24c.59.3-1.11,1.45-1.54,1.95l-6.92,2.84,3.35,5.76c-5.07,3.48-13.16.58-13.87,4.94s3.95,6.04,7.52,7.58c4.61,2,8.92,5.99,14.37,5.34,3.22-.38,7.85-1.14,10.28-.63.8.17,2.79,2.61,2.49,3.38-.36.91-2.22,2.5-3.21,2.79l-7.14,2.11c6.75,6.58,9.38-4.22,14.25-2.95l14.02,3.66c.53.14,1.99.9,1.95,1.38l-.16,2.31c6.13,3.44,15.95-.86,16.89-3.09.57-1.36.26-4.34.05-6.26,3.82-.43,7.53-1.05,10.38-2.7l8.25,5.31c41.91,23.55,86.55,40.67,132.38,55.31l8.46,1.39c.62.54,2.29,1.79,2.04,2.62l-1.17,3.81c-6.1,2-12.02-.36-18.98,4.35-.74.5-1.74,2.84-1.37,3.65.45.96,2.17,2,3.67,2.74l9.05,4.46c.34.17.81,1.66.49,1.72l-2.36.44-3.24.19-1.52-.8c-1.6-.85-.05,5.16-4.2,6.99-1.16.51-2.99,1.21-2.93,1.97l.36,4.31c.11,1.32-1.7,3.74-2.78,5.07-.57-1.07-2.85-1.41-3.94-1.42l-6,.14-7.76-2.51c-2.8-.9-5.38-1.42-7.87-1.43l-23.74-.15c-.6-1.36-1.91-3.73-3.21-4.33-1.69-.77-5-.21-6.76.51l-8.08,3.28-11.25,4.21c-3.06,1.15-5.32,5.78-6.59,9.22l7.9,2.02.03,4.95c-2.8-.2-4.92.7-5.42,2.46,1.57,1.41,4.77,3.43,6.76,3.53,2.98.15,6.48.67,9.06,1.83,3.58,1.6,4.11,3.42,5.52,7.16,1.44,3.75,5.12,7.9,7.42,11.11h-170l8.86-2.97c1.63-.05,5.95,1.21,7.2.12,1.91-1.67.74-5.58-.93-7.49l3.23-3.84-5.44-4.37,3.09-6.43,6.32-3.62c-9.83-4.67-19.04-3.12-28.25-1.68-6.09.95-11.46,2.71-17.63,6.05l-12.51.16c-7.41.09-14.69,4.44-16.51,11.9l-6.65.64c2.84,2.4,6.87,1.3,10.62-.01l10.96,3.07c1.08,3.31,3.06,5.99,6.63,5.45,8.16-1.22,15.99-1.18,23.61-.45l5.39,3.47H0v-7l4.71-6.13c3.92-.39,7.08-1.24,10.14-2.57l.55,4.55c.12,1.01,2.65,2.06,3.73,2.06l12.9.08c-5.42-3.77-5.46-7.81-9.77-10.45,1.57-1.4,2.99-3.84,2.77-6.73l-8.84,1.5c.33,2.97-.49,5.91-2.03,6.55-1.97.82-5.15-1.22-6.2-2.98l-7.95-1.88ZM1426.62,227.66c.98-.72.21-4.44-.99-4.78l-4.33-1.23c-4.03-1.14-6.68-1.9-11-1.18,5.13,5.16,12.51,9.6,16.33,7.19ZM41.86,384.65c3-.7,8.46,2.43,10.43-3.27-.84-.36-3.7-.98-4.97-.85l-12.59,1.27-10.67,2.54c6.43,6.08,11.36,2.36,17.8.31ZM54.32,405.99c-5.37-3.87-9.91-5.89-16.06-4.31l5.64,4.48c3.03,2.41,7.76,3.34,10.42-.18ZM1430.63,613.11c-.41-4.63.22-4.91,2.93-9.1l-12.76.29-1.28,5.03-2.8,4.07c-.56.81,1.44,3.89,2.46,3.81,3.28-.24,9.11-2.54,11.44-4.1ZM1398.2,658.27c-1.13-1.66-2.09-2.78-1.74-3.32l1.38-2.12c.48-.73,1.11-2.42,1.32-3.17.16-.56-2.13-1.51-2.71-1.52l-13.42-.15c-1.13-.01-3.72,1.49-5.2,2.4l7.64,7.21c3.57,3.37,9.43,4.66,12.72.68ZM1380.96,676.14l9.18-7.59-8.33-.57c-.97-.07-2.82-1.15-3.73-1.8l1.06,7.03c-1.7-1.36-3.21-3.29-4.4-2.91l-4.88,1.53c2.02,4.07,8.05,6.83,11.1,4.32ZM1284.62,792.2l-5.35,3.06,4.38.64-6.5,3.48c-.72.3-2.99.62-2.94,1.36l.23,3.37-.08,8.02-2.27,1.38c-.42.25,1.66,1.24,2.52,1.67l-1.59,1.54,5.15.72-9.88,2.49c2.14,1.89,4.25,2.33,6.6,2.08l7.39-.77-.89,4.58c-.14.71,1.82,2.46,2.51,2.66l12.43,3.43c2.03.56,6.31,3.06,7.91,1.79,10.13-7.98,16.25-3.86,21.63-10.02-2.15-2.79-3.31-4.97-2.64-7.8.98-4.12,6.25-4.11,7.9-7.22-2.63-3.41-1.9-4.92-.83-8.19.7-2.14,1.24-4.68,3.1-5.6,1.41-.7,4.44-.26,6.04.35,7.83,2.95,13.13-3.31,19.18-6.4l10.64-5.42-7.57-4.05c-1.8-5.05-5.58-2.13-13.82-7.06-5.12-3.06-11.41-.31-16.79-.5l-21.21-.73c-12.69-.44-24.55,2.68-36.21,7.76l-6.26.4-8.34,11.66c4.03,3.66,7.73,2.94,12.2,2.43l13.35-1.11ZM1406.11,795.64c4.7-6.24-5.16-1.67-10.86-2.44l-3.03-.41c-.64-.09-.68,1.37-.09,1.54,6.75,2.02,10.95,5.33,11.85,4.14l2.14-2.84ZM141.72,849.89c.69-.22,2.68-.09,2.81-.84l.52-3.06,1.15-1.85c2.33-2.87,4.11-10.11,3.17-15.41.98-1.18,5.68-3.47,3.17-6.58-1.78-2.2-5.76-4.08-8.55-5.1-2.3-3.37-6.96-3.79-11.02-2.22l-9.83-3.52-2.46.21c-.63.05-.19-1.98.16-3.17l-2.57.02.24,2.97c.06.68-2.05-.09-2.84-.27l-17.93-4.05c-3.35-.76-9.88-2.25-10.76,2.79,1.05,4,1.99,7.27-2.31,10.33-2.15,1.53-3.12,6.69-4.23,9.12-2.75,5.98-8.7,8.49-13.59,11.67-5.32,3.45-10.3,5.37-16.62,6.64l-10.74,2.16-1.18,6.79c-.12.69,1.77,2.75,2.43,2.49,3.34-1.34,2.42-4.14,11.39-7.02l6.62-2.12c14.45-4.64,24.18.26,29.12-8.92.99-1.84,5.04-1.74,6.72-1.07,2.06.82,3.73,3.38,4.91,6.16,4.42-1.31,9.47-2.29,13.76-2.01l-3.95,8.61-13.07,2.7c.48,1.4.73,3.45,1.58,3.51l4.36.31,18.78,1.05c1.07.06,2.54,2.26,2.35,3.24-.23,1.17-2.51,3.2-3.72,3.23l-18.53.55c-4.21,2.66-7.35,3.62-13.44,3.08l8.93,3.04-6.45,3.45c3.45-.07,10.2-.21,12.99-2.41,3.02-2.39,3.73-3.99,8.23-3.3,1.66.25,4.23-.79,6.07-2.02l1.04,2.78c2.79-4.41,7.92-1.93,12.38-8.1l7.31-4.43-1.41-6.51,5.02-2.89ZM1406.18,819.67l-4.12-8.81c-.48-1.02-2.43-3.26-3.44-2.82l-4.05,1.78c-4.63-.96-12.53-1.62-17.36-.14l-4.6,9.98-2.48,2.79c-.47.53,1.66,2.34,2.31,2.06,2.59-1.1,7.66-3.47,10.84-3.86,9.67-1.21,14.75,3.18,22.89-.98ZM251.81,889.3c4.37-2.79,6.42-6.5,5.84-9.23-.15-.7-2.02-2-2.72-2.16l-5.83-1.37-10.16.32c-3.2.1-5.75.84-6.84,3.87-.6,1.67,1.11,5.17,3.15,5.73l8.04,2.24c.53,1.39,2.9,4.18,4.02,3.46l4.49-2.86Z"/></svg>`;

  const DEPTH_LAYERS = 4;
  const instances = [];
  let rafId = null;
  let time = 0;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  class WatermarkInstance {
    constructor(options = {}) {
      this.container = options.container || document.body;
      this.opacity = options.opacity || 0.03;
      this.blendMode = options.blendMode || 'overlay';
      this.position = options.position || 'center';
      this.scale = options.scale || 1;
      this.rotation = options.rotation || 0;
      this.animated = options.animated !== false;
      this.parallax = options.parallax || 0;
      this.colorFilter = options.colorFilter || 'none';
      this.depth3D = options.depth3D !== false;
      this.layers = options.layers || DEPTH_LAYERS;
      this.perspective = options.perspective || 1000;
      this.glow = options.glow !== false;
      this.shimmer = options.shimmer !== false;
      this.id = `wm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.element = null;
      this.layersElements = [];
      this.bounds = { x: 0, y: 0, w: 0, h: 0 };
      this.mouseX = 0;
      this.mouseY = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.currentX = 0;
      this.currentY = 0;
      this.currentRotX = 0;
      this.currentRotY = 0;
      this.phase = Math.random() * Math.PI * 2;
      this.speed = options.speed || 0.0005;
      this.amplitude = options.amplitude || 20;
      this.depthAmplitude = options.depthAmplitude || 80;
      this.shimmerPhase = Math.random() * Math.PI * 2;
      
      this.init();
    }

    init() {
      this.createElement();
      this.bindEvents();
      if (this.animated) {
        this.animate();
      }
    }

    createElement() {
      this.element = document.createElement('div');
      this.element.className = 'watermark-instance';
      this.element.dataset.id = this.id;
      this.element.dataset.watermarkId = this.id;
      this.element.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: ${this.getZIndex()};
        pointer-events: none;
        opacity: ${this.opacity};
        mix-blend-mode: ${this.blendMode};
        overflow: hidden;
        transform-origin: center center;
        perspective: ${this.perspective}px;
        transform-style: preserve-3d;
      `;

      if (this.glow) {
        this.createGlowLayer();
      }

      for (let i = 0; i < this.layers; i++) {
        this.createDepthLayer(i);
      }

      if (this.shimmer) {
        this.createShimmerLayer();
      }

      this.container.appendChild(this.element);
      this.updatePosition();
    }

    createGlowLayer() {
      this.glowElement = document.createElement('div');
      this.glowElement.className = 'watermark-glow';
      this.glowElement.style.cssText = `
        position: absolute;
        inset: -20%;
        background: radial-gradient(ellipse at center, 
          rgba(192,132,252,0.15) 0%, 
          rgba(139,92,246,0.08) 30%, 
          transparent 70%);
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        transition: opacity 2s ease;
      `;
      this.element.appendChild(this.glowElement);
    }

    createDepthLayer(index) {
      const layer = document.createElement('div');
      layer.className = 'watermark-depth-layer';
      layer.dataset.depth = index;
      
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(SVG_DATA, 'image/svg+xml');
      const svgEl = svgDoc.documentElement;
      svgEl.setAttribute('preserveAspectRatio', 'none');
      
      const depthRatio = (index + 1) / this.layers;
      const baseOpacity = this.opacity * (0.3 + depthRatio * 0.7);
      const layerScale = 1 + depthRatio * 0.3;
      const layerBlur = depthRatio * 2;
      const layerFilter = this.getColorFilter();
      
      layer.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: ${baseOpacity};
        mix-blend-mode: ${this.blendMode};
        transform-origin: center center;
        transform-style: preserve-3d;
        filter: ${layerFilter} blur(${layerBlur}px);
        will-change: transform, opacity, filter;
      `;

      svgEl.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
        transform-origin: center center;
      `;

      layer.appendChild(svgEl);
      this.layersElements.push({
        element: layer,
        svg: svgEl,
        index,
        depthRatio,
        baseOpacity,
        layerScale,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0003 + index * 0.00015,
        rotX: 0,
        rotY: 0,
        tx: 0,
        ty: 0,
        tz: -index * 40,
        scale: 1
      });
      this.element.appendChild(layer);
    }

    createShimmerLayer() {
      this.shimmerElement = document.createElement('div');
      this.shimmerElement.className = 'watermark-shimmer';
      this.shimmerElement.style.cssText = `
        position: absolute;
        inset: 0;
        background: linear-gradient(
          110deg,
          transparent 40%,
          rgba(255,255,255,0.15) 50%,
          transparent 60%
        );
        background-size: 200% 100%;
        opacity: 0;
        pointer-events: none;
        mix-blend-mode: screen;
        animation: shimmerFlow 4s ease-in-out infinite;
      `;
      this.element.appendChild(this.shimmerElement);
    }

    getZIndex() {
      const positions = {
        'background': 0,
        'behind-content': 1,
        'overlay': 10,
        'foreground': 100
      };
      return positions[this.position] || 1;
    }

    getColorFilter() {
      const filters = {
        'none': 'none',
        'violet': 'hue-rotate(260deg) saturate(1.3) brightness(1.1)',
        'blue': 'hue-rotate(200deg) saturate(1.2) brightness(1.05)',
        'gold': 'hue-rotate(45deg) saturate(1.4) brightness(1.1)',
        'rose': 'hue-rotate(320deg) saturate(1.3) brightness(1.05)',
        'monochrome': 'grayscale(1) contrast(1.3) brightness(1.1)',
        'invert': 'invert(1) hue-rotate(180deg)',
        'sepia': 'sepia(1) contrast(1.2) brightness(1.1)',
        'holographic': 'hue-rotate(180deg) saturate(2) brightness(1.2)',
        'iridescent': 'hue-rotate(0deg) saturate(1.5) brightness(1.15)'
      };
      return filters[this.colorFilter] || 'none';
    }

    bindEvents() {
      if (this.parallax > 0 || this.depth3D) {
        document.addEventListener('mousemove', (e) => {
          mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
          mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });
      }

      window.addEventListener('resize', () => this.updatePosition(), { passive: true });
      
      if (this.glow) {
        this.element.addEventListener('mouseenter', () => {
          if (this.glowElement) this.glowElement.style.opacity = '0.6';
        });
        this.element.addEventListener('mouseleave', () => {
          if (this.glowElement) this.glowElement.style.opacity = '0';
        });
      }
    }

    updatePosition() {
      if (!this.element) return;
      
      const rect = this.container.getBoundingClientRect();
      this.bounds = { 
        x: rect.left, 
        y: rect.top, 
        w: rect.width, 
        h: rect.height 
      };

      const positions = {
        'center': { x: 50, y: 50 },
        'top-left': { x: 10, y: 10 },
        'top-right': { x: 90, y: 10 },
        'bottom-left': { x: 10, y: 90 },
        'bottom-right': { x: 90, y: 90 },
        'top': { x: 50, y: 15 },
        'bottom': { x: 50, y: 85 },
        'left': { x: 15, y: 50 },
        'right': { x: 85, y: 50 }
      };

      const pos = positions[this.position] || positions.center;
      this.targetX = (pos.x / 100 - 0.5) * this.bounds.w * 0.4;
      this.targetY = (pos.y / 100 - 0.5) * this.bounds.h * 0.4;
    }

    animate() {
      if (!this.animated) return;
      
      const tick = () => {
        if (!this.element) return;

        time += 16;
        this.phase += this.speed * 16;
        this.shimmerPhase += 0.008;

        const ease = 0.04;
        const depthEase = 0.025;

        if (this.depth3D) {
          this.currentX += (this.targetX + mouse.x * this.parallax * 40 - this.currentX) * ease;
          this.currentY += (this.targetY + mouse.y * this.parallax * 40 - this.currentY) * ease;
          
          this.currentRotX += (-mouse.y * 8 - this.currentRotX) * depthEase;
          this.currentRotY += (mouse.x * 8 - this.currentRotY) * depthEase;
        } else {
          this.currentX += (this.targetX - this.currentX) * ease;
          this.currentY += (this.targetY - this.currentY) * ease;
        }

        this.phase += this.speed * 16;
        this.shimmerPhase += 0.012;

        const baseDriftX = Math.sin(this.phase * 0.6) * this.amplitude * 0.4;
        const baseDriftY = Math.cos(this.phase * 0.45) * this.amplitude * 0.3;
        const baseRotation = Math.sin(this.phase * 0.25) * 0.6;
        const baseScale = 1 + Math.sin(this.phase * 0.18) * 0.025;

        if (this.glow && this.glowElement) {
          const glowIntensity = 0.3 + Math.sin(this.phase * 0.15) * 0.2;
          this.glowElement.style.opacity = this.glowElement.style.opacity === '0' ? '0' : glowIntensity;
        }

        this.layersElements.forEach((layer, i) => {
          const depth = layer.depthRatio;
          const layerPhase = this.phase * layer.speed * 1000;
          
          layer.tx += (this.currentX * (0.5 + depth * 0.8) - layer.tx) * 0.03;
          layer.ty += (this.currentY * (0.5 + depth * 0.8) - layer.ty) * 0.03;
          layer.tz += (-i * 50 + Math.sin(layerPhase * 0.001) * this.depthAmplitude * 0.5 - layer.tz) * 0.02;
          
          layer.rotX += (this.currentRotX * (0.3 + depth * 0.7) - layer.rotX) * 0.02;
          layer.rotY += (this.currentRotY * (0.3 + depth * 0.7) - layer.rotY) * 0.02;
          
          layer.scale = 1 + Math.sin(layerPhase * 0.0008) * 0.03 * (1 + depth);
          
          const driftX = Math.sin(layerPhase * 0.0005) * this.amplitude * 0.3 * (1 + depth);
          const driftY = Math.cos(layerPhase * 0.0004) * this.amplitude * 0.2 * (1 + depth);
          const rotation = Math.sin(layerPhase * 0.0003) * 0.4 * depth;
          
          const opacity = layer.baseOpacity * (0.9 + Math.sin(layerPhase * 0.0006) * 0.1);
          
          layer.element.style.opacity = opacity;
          layer.svg.style.transform = `
            perspective(${this.perspective}px)
            translate3d(${layer.tx + driftX}px, ${layer.ty + driftY}px, ${layer.tz}px)
            rotateX(${layer.rotX}deg)
            rotateY(${layer.rotY}deg)
            rotateZ(${rotation}deg)
            scale3d(${layer.scale}, ${layer.scale}, ${layer.scale})
          `;
        });

        if (this.shimmerElement) {
          const shimmerProgress = (this.shimmerPhase % (Math.PI * 2)) / (Math.PI * 2);
          this.shimmerElement.style.backgroundPosition = `${shimmerProgress * 200 - 100}% 0`;
          const shimmerOpacity = 0.05 + Math.sin(this.shimmerPhase * 0.5) * 0.03;
          this.shimmerElement.style.opacity = shimmerOpacity;
        }

        const globalRotation = this.depth3D ? 0 : baseRotation;
        const globalScale = this.depth3D ? 1 : baseScale;
        
        this.element.style.transform = `
          perspective(${this.perspective}px)
          translate3d(${this.currentX + baseDriftX}px, ${this.currentY + baseDriftY}px, 0)
          rotateX(${this.currentRotX}deg)
          rotateY(${this.currentRotY}deg)
          rotateZ(${globalRotation}deg)
          scale3d(${globalScale}, ${globalScale}, ${globalScale})
        `;

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    }

    destroy() {
      cancelAnimationFrame(rafId);
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      const idx = instances.indexOf(this);
      if (idx > -1) instances.splice(idx, 1);
    }

    setOpacity(opacity) {
      this.opacity = Math.max(0, Math.min(1, opacity));
      if (this.element) this.element.style.opacity = this.opacity;
    }

    setPosition(position) {
      this.position = position;
      this.element.style.zIndex = this.getZIndex();
      this.updatePosition();
    }

    setScale(scale) {
      this.scale = scale;
    }

    setDepth3D(enabled) {
      this.depth3D = enabled;
    }

    pause() {
      this.animated = false;
      cancelAnimationFrame(rafId);
    }

    resume() {
      if (!this.animated) {
        this.animated = true;
        this.animate();
      }
    }

    setColorFilter(filter) {
      this.colorFilter = filter;
      this.layersElements.forEach(layer => {
        layer.element.style.filter = this.getColorFilter() + ' blur(' + (layer.index / this.layers * 2) + 'px)';
        layer.svg.style.filter = this.getColorFilter();
      });
      if (this.shimmerElement) {
        this.shimmerElement.style.filter = this.getColorFilter();
      }
    }

    setGlow(intensity) {
      if (this.glowElement) {
        this.glowElement.style.opacity = intensity;
      }
    }
  }

  function create(options) {
    const instance = new WatermarkInstance(options);
    instances.push(instance);
    return instance;
  }

  function createMultiple(configs) {
    return configs.map(cfg => create(cfg));
  }

  function destroyAll() {
    instances.forEach(inst => inst.destroy());
    instances.length = 0;
  }

  function getInstance(id) {
    return instances.find(inst => inst.id === id);
  }

  function pauseAll() {
    instances.forEach(inst => inst.pause());
  }

  function resumeAll() {
    instances.forEach(inst => inst.resume());
  }

  function setAllOpacity(opacity) {
    instances.forEach(inst => inst.setOpacity(opacity));
  }

  const presets = {
    subtle: { opacity: 0.02, blendMode: 'overlay', animated: true, amplitude: 10, depthAmplitude: 30 },
    ambient: { opacity: 0.04, blendMode: 'overlay', animated: true, amplitude: 15, depthAmplitude: 50, parallax: 0.15 },
    prominent: { opacity: 0.08, blendMode: 'soft-light', animated: true, amplitude: 25, depthAmplitude: 100, speed: 0.0008 },
    hero: { opacity: 0.05, blendMode: 'overlay', animated: true, position: 'center', scale: 1.2, depth3D: true, depthAmplitude: 60 },
    corner: { opacity: 0.03, blendMode: 'overlay', position: 'bottom-right', animated: false },
    section: { opacity: 0.025, blendMode: 'overlay', animated: true, amplitude: 8, depthAmplitude: 25 },
    violet: { opacity: 0.04, blendMode: 'overlay', colorFilter: 'violet', animated: true, depthAmplitude: 50 },
    gold: { opacity: 0.035, blendMode: 'soft-light', colorFilter: 'gold', animated: true, depthAmplitude: 40 },
    rose: { opacity: 0.04, blendMode: 'overlay', colorFilter: 'rose', animated: true, depthAmplitude: 45 },
    monochrome: { opacity: 0.05, blendMode: 'multiply', colorFilter: 'monochrome', animated: false },
    holographic: { opacity: 0.045, blendMode: 'screen', colorFilter: 'holographic', animated: true, depth3D: true, depthAmplitude: 80, shimmer: true, glow: true, parallax: 0.2 },
    iridescent: { opacity: 0.04, blendMode: 'color-dodge', colorFilter: 'iridescent', animated: true, depth3D: true, depthAmplitude: 70, shimmer: true, speed: 0.0006 }
  };

  function createFromPreset(presetName, overrides = {}) {
    const preset = presets[presetName] || presets.subtle;
    return create({ ...preset, ...overrides });
  }

  function integrateWithFiligrana() {
    if (window.FILIGRANA) {
      const originalSetSection = window.FILIGRANA.setSection;
      window.FILIGRANA.setSection = function(section) {
        originalSetSection.call(this, section);
        const watermarkMap = {
          'home': 'subtle',
          'chi-siamo': 'violet',
          'eventi': 'gold',
          'gallery': 'rose',
          'video': 'ambient',
          'blog': 'section',
          'classifica': 'prominent',
          'comando': 'monochrome',
          'account': 'hero'
        };
        const preset = watermarkMap[section] || 'subtle';
        if (window.currentWatermark) {
          window.currentWatermark.destroy();
        }
        window.currentWatermark = createFromPreset(preset, { 
          container: document.body 
        });
      };
    }
  }

  function initSectionWatermarks() {
    const sections = document.querySelectorAll('[data-view], section.view, main section');
    sections.forEach(section => {
      const view = section.dataset.view || section.id?.replace('view-', '') || section.classList[0]?.replace('view-', '');
      if (!view) return;

      const watermarkConfigs = {
        'home': { preset: 'subtle', container: section },
        'chi-siamo': { preset: 'violet', container: section },
        'eventi': { preset: 'gold', container: section },
        'gallery': { preset: 'rose', container: section },
        'video': { preset: 'ambient', container: section },
        'blog': { preset: 'section', container: section },
        'classifica': { preset: 'prominent', container: section },
        'comando': { preset: 'monochrome', container: section },
        'account': { preset: 'hero', container: section }
      };

      const config = watermarkConfigs[view];
      if (config) {
        createFromPreset(config.preset, { container: config.container });
      }
    });
  }

  function observeVisibility() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const watermark = entry.target.dataset.watermarkId;
        if (!watermark) return;
        const inst = getInstance(watermark);
        if (inst) {
          if (entry.isIntersecting) inst.resume();
          else inst.pause();
        }
      });
    }, { rootMargin: '100px', threshold: 0.1 });

    instances.forEach(inst => {
      if (inst.element) observer.observe(inst.element);
    });
  }

  return {
    create,
    createMultiple,
    createFromPreset,
    destroyAll,
    getInstance,
    pauseAll,
    resumeAll,
    setAllOpacity,
    integrateWithFiligrana,
    initSectionWatermarks,
    observeVisibility,
    presets
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WATERMARK;
}