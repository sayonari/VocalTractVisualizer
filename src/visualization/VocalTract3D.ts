import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export interface VocalTract3DConfig {
  tractLength: number;  // 声道長 (cm)
  numSections: number;  // セクション数
  maxRadius: number;    // 最大半径 (cm)
  wireframe: boolean;
  color: string;
  opacity: number;
}

export class VocalTract3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private tractMesh: THREE.Mesh | null = null;
  private config: VocalTract3DConfig;
  private container: HTMLElement;
  private animationId: number | null = null;

  constructor(
    container: HTMLElement,
    config: Partial<VocalTract3DConfig> = {}
  ) {
    this.container = container;
    this.config = {
      tractLength: 17.5,  // 標準的な成人男性の声道長
      numSections: 15,    // LPC次数+1
      maxRadius: 2.0,
      wireframe: true,    // デフォルトをワイヤーフレームに
      color: '#ff6b6b',
      opacity: 0.9,
      ...config
    };

    // Three.jsのセットアップ
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);

    // カメラのセットアップ
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 12, 25);  // より高い位置から見る
    this.camera.lookAt(0, -2, 0);  // 少し下を向く

    // レンダラーのセットアップ
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // コントロールのセットアップ
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;

    // ライティング
    this.setupLighting();

    // 座標軸の追加
    this.addAxesHelper();

    // 初期モデルの作成
    this.createInitialModel();

    // アニメーション開始
    this.animate();

    // リサイズハンドラ
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private setupLighting(): void {
    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 指向性ライト
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 10);
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, -10, -10);
    this.scene.add(directionalLight2);
  }

  private addAxesHelper(): void {
    const axesHelper = new THREE.AxesHelper(20);
    this.scene.add(axesHelper);

    // グリッド
    const gridHelper = new THREE.GridHelper(40, 20);
    gridHelper.position.y = -2;  // グリッドの位置をさらに上げる
    this.scene.add(gridHelper);
  }

  private createInitialModel(): void {
    const areas = new Float32Array(this.config.numSections).fill(1.0);
    this.updateVocalTract(areas);
  }

  /**
   * 声道モデルの更新
   * @param areas 各セクションの面積（正規化済み）
   */
  updateVocalTract(areas: Float32Array): void {
    // 既存のメッシュを削除
    if (this.tractMesh) {
      this.scene.remove(this.tractMesh);
      this.tractMesh.geometry.dispose();
      if (this.tractMesh.material instanceof THREE.Material) {
        this.tractMesh.material.dispose();
      }
    }

    // チューブジオメトリの作成（色情報付き）
    const { geometry, colors } = this.createTubeGeometryWithColors(areas);

    // マテリアルの作成（頂点カラーを使用）
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.config.opacity,
      wireframe: this.config.wireframe,
      side: THREE.DoubleSide
    });

    // メッシュの作成
    this.tractMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.tractMesh);
  }

  /**
   * チューブジオメトリの作成
   */
  private createTubeGeometry(areas: Float32Array): THREE.BufferGeometry {
    const numSections = areas.length;
    const sectionLength = this.config.tractLength / (numSections - 1);
    
    // パスポイントの作成
    const points: THREE.Vector3[] = [];
    const radii: number[] = [];
    
    for (let i = 0; i < numSections; i++) {
      const x = i * sectionLength - this.config.tractLength / 2;
      points.push(new THREE.Vector3(x, 0, 0));
      
      // 面積から半径を計算
      const radius = Math.sqrt(areas[i]) * this.config.maxRadius;
      radii.push(radius);
    }

    // カスタムチューブジオメトリの作成
    return this.createCustomTubeGeometry(points, radii);
  }

  /**
   * 色付きチューブジオメトリの作成
   */
  private createTubeGeometryWithColors(areas: Float32Array): { geometry: THREE.BufferGeometry, colors: Float32Array } {
    const numSections = areas.length;
    const sectionLength = this.config.tractLength / (numSections - 1);
    
    // パスポイントの作成
    const points: THREE.Vector3[] = [];
    const radii: number[] = [];
    
    for (let i = 0; i < numSections; i++) {
      const x = i * sectionLength - this.config.tractLength / 2;
      points.push(new THREE.Vector3(x, 0, 0));
      
      // 面積から半径を計算
      const radius = Math.sqrt(areas[i]) * this.config.maxRadius;
      radii.push(radius);
    }

    // カスタムチューブジオメトリの作成（色情報付き）
    return this.createCustomTubeGeometryWithColors(points, radii, areas);
  }

  /**
   * 可変半径チューブジオメトリの作成
   */
  private createCustomTubeGeometry(
    points: THREE.Vector3[],
    radii: number[]
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    
    const radialSegments = 32;
    const numPoints = points.length;
    
    // 各断面の頂点を生成
    for (let i = 0; i < numPoints; i++) {
      const point = points[i];
      const radius = radii[i];
      
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        
        const x = point.x;
        const y = point.y + Math.cos(theta) * radius;
        const z = point.z + Math.sin(theta) * radius;
        
        vertices.push(x, y, z);
        
        // 法線の計算
        const nx = 0;
        const ny = Math.cos(theta);
        const nz = Math.sin(theta);
        normals.push(nx, ny, nz);
      }
    }
    
    // インデックスの生成
    for (let i = 0; i < numPoints - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        const c = a + 1;
        const d = b + 1;
        
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }
    
    // ジオメトリに属性を設定
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    
    return geometry;
  }

  /**
   * 色付き可変半径チューブジオメトリの作成
   */
  private createCustomTubeGeometryWithColors(
    points: THREE.Vector3[],
    radii: number[],
    areas: Float32Array
  ): { geometry: THREE.BufferGeometry, colors: Float32Array } {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    const radialSegments = 32;
    const numPoints = points.length;
    
    // カラーマップの作成（狭い部分は赤、広い部分は青）
    const getColor = (area: number, position: number) => {
      // 面積に基づく色（HSL色空間を使用）
      const hue = (1 - area) * 240; // 青(240°)から赤(0°)へ
      const saturation = 0.8;
      const lightness = 0.5 + position * 0.2; // 位置によって明度を変化
      
      // HSLからRGBへ変換
      const { r, g, b } = this.hslToRgb(hue / 360, saturation, lightness);
      return { r, g, b };
    };
    
    // 各断面の頂点を生成
    for (let i = 0; i < numPoints; i++) {
      const point = points[i];
      const radius = radii[i];
      const area = areas[i];
      const position = i / (numPoints - 1);
      
      // セクションごとの色を計算
      const color = getColor(area, position);
      
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        
        const x = point.x;
        const y = point.y + Math.cos(theta) * radius;
        const z = point.z + Math.sin(theta) * radius;
        
        vertices.push(x, y, z);
        
        // 法線の計算
        const nx = 0;
        const ny = Math.cos(theta);
        const nz = Math.sin(theta);
        normals.push(nx, ny, nz);
        
        // 色の追加
        colors.push(color.r, color.g, color.b);
      }
    }
    
    // インデックスの生成
    for (let i = 0; i < numPoints - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        const c = a + 1;
        const d = b + 1;
        
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }
    
    // ジオメトリに属性を設定
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    // セクション境界にラインを追加
    this.addSectionLines(points, radii);
    
    return { geometry, colors: new Float32Array(colors) };
  }

  /**
   * HSLからRGBへの変換
   */
  private hslToRgb(h: number, s: number, l: number): { r: number, g: number, b: number } {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return { r, g, b };
  }

  /**
   * セクション境界線の追加
   */
  private addSectionLines(points: THREE.Vector3[], radii: number[]): void {
    // 既存のラインを削除
    const oldLines = this.scene.children.filter(child => child.name === 'sectionLine');
    oldLines.forEach(line => this.scene.remove(line));
    
    // 各セクションに円形のラインを追加
    for (let i = 0; i < points.length; i++) {
      const lineGeometry = new THREE.BufferGeometry();
      const lineVertices: number[] = [];
      const radialSegments = 32;
      
      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const x = points[i].x;
        const y = points[i].y + Math.cos(theta) * radii[i];
        const z = points[i].z + Math.sin(theta) * radii[i];
        lineVertices.push(x, y, z);
      }
      
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x333333,
        opacity: 0.3,
        transparent: true
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.name = 'sectionLine';
      this.scene.add(line);
    }
  }

  /**
   * アニメーションループ
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // コントロールの更新
    this.controls.update();
    
    // レンダリング
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * リサイズハンドラ
   */
  private handleResize(): void {
    // コンテナが存在しない場合は処理しない
    if (!this.container || !this.container.parentElement) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (width > 0 && height > 0 && this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      this.renderer.setSize(width, height);
    }
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<VocalTract3DConfig>): void {
    this.config = { ...this.config, ...config };
    
    // ワイヤーフレームや色の変更を反映
    if (this.tractMesh && this.tractMesh.material instanceof THREE.MeshPhongMaterial) {
      this.tractMesh.material.wireframe = this.config.wireframe;
      this.tractMesh.material.color.set(this.config.color);
      this.tractMesh.material.opacity = this.config.opacity;
    }
  }

  /**
   * カメラ位置のリセット
   */
  resetCamera(): void {
    this.camera.position.set(0, 12, 25);  // より高い位置から見る
    this.camera.lookAt(0, -2, 0);  // 少し下を向く
    this.controls.reset();
  }

  /**
   * スクリーンショットの取得
   */
  getScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    // リソースの解放
    if (this.tractMesh) {
      this.scene.remove(this.tractMesh);
      this.tractMesh.geometry.dispose();
      if (this.tractMesh.material instanceof THREE.Material) {
        this.tractMesh.material.dispose();
      }
    }
    
    this.renderer.dispose();
    this.controls.dispose();
    
    // DOMからの削除
    this.container.removeChild(this.renderer.domElement);
    
    // イベントリスナーの削除
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}