import { cores, simbolo } from "@guardiao/brand";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Vector2, type Group, type Mesh, type MeshStandardMaterial, type Points, type PointsMaterial } from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * As três cenas 3D do pitch usam o mesmo objeto: o escudo do logo, extrudado a partir da
 * geometria de packages/brand. Assim o 3D reforça a marca em vez de competir com ela.
 *
 *   formando  (slide 3)   partículas ciano se juntam no contorno e o volume aparece — 2,5 s
 *   vivo      (slide 6)   o escudo gira devagar, com parallax do mouse, e os pontos pulsam — em loop
 *   fechando  (slide 11)  o escudo avança até ocupar a tela e brilha uma vez — 2 s
 */
export type ModoCena = "formando" | "vivo" | "fechando";

const PROFUNDIDADE = 12;
const PARTICULAS = 1400;
const suave = (t: number) => 1 - (1 - t) ** 3;
const limitar = (t: number) => Math.min(1, Math.max(0, t));

function montarEscudo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${simbolo.viewBox}"><path d="${simbolo.escudo}"/></svg>`;
  const formas = new SVGLoader().parse(svg).paths.flatMap((caminho) => SVGLoader.createShapes(caminho));
  const corpo = new ExtrudeGeometry(formas, { depth: PROFUNDIDADE, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.2, bevelSegments: 4 });
  corpo.computeBoundingBox();
  const caixa = corpo.boundingBox!;
  const centro = new Vector2((caixa.min.x + caixa.max.x) / 2, (caixa.min.y + caixa.max.y) / 2);
  // No SVG o y cresce para baixo; no 3D, para cima. Daqui em diante tudo fica centrado e com o y invertido.
  corpo.translate(-centro.x, -centro.y, -PROFUNDIDADE / 2);
  corpo.scale(1, -1, 1);
  // Inverter um eixo inverte as faces: reordena os triângulos para a frente continuar sendo a frente.
  const indice = corpo.getIndex();
  if (indice) {
    for (let i = 0; i < indice.count; i += 3) {
      const a = indice.getX(i);
      indice.setX(i, indice.getX(i + 2));
      indice.setX(i + 2, a);
    }
  } else {
    const p = corpo.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
      p.setXYZ(i, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
  }
  corpo.computeVertexNormals();

  const contorno = formas.flatMap((forma) => forma.getSpacedPoints(Math.ceil(PARTICULAS / formas.length)));
  const alvo = new Float32Array(PARTICULAS * 3);
  const origem = new Float32Array(PARTICULAS * 3);
  for (let i = 0; i < PARTICULAS; i++) {
    const ponto = contorno[i % contorno.length]!;
    alvo.set([ponto.x - centro.x, -(ponto.y - centro.y), (Math.random() - 0.5) * PROFUNDIDADE], i * 3);
    // Começam espalhadas numa casca em volta do escudo.
    const angulo = Math.random() * Math.PI * 2;
    const altura = (Math.random() - 0.5) * 2;
    const raio = 90 + Math.random() * 110;
    origem.set([Math.cos(angulo) * raio * Math.sqrt(1 - altura * altura), altura * raio, Math.sin(angulo) * raio * 0.6], i * 3);
  }
  const pontos = simbolo.pontos.map((p) => ({ x: p.cx - centro.x, y: -(p.cy - centro.y), r: p.r }));
  return { corpo, alvo, origem, pontos };
}

function Escudo({ modo, parado, quadro }: { modo: ModoCena; parado: boolean; quadro: number | null }) {
  const { corpo, alvo, origem, pontos } = useMemo(montarEscudo, []);
  const grupo = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const particulas = useRef<Points>(null);
  const bolinhas = useRef<(Mesh | null)[]>([]);
  const inicio = useRef<number | null>(null);

  const nuvem = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(origem.slice(), 3));
    return g;
  }, [origem]);

  useFrame(({ clock, pointer }) => {
    inicio.current ??= clock.elapsedTime;
    const decorrido = clock.elapsedTime - inicio.current;
    const g = grupo.current;
    const m = material.current;
    if (!g || !m) return;

    if (modo === "formando") {
      // Com movimento reduzido ou no quadro final, t = 1: só o escudo pronto.
      const t = quadro ?? (parado ? 1 : limitar(decorrido / 2.5));
      const junta = suave(limitar(t / 0.75));
      const posicoes = nuvem.getAttribute("position") as BufferAttribute;
      for (let i = 0; i < PARTICULAS * 3; i++) posicoes.array[i] = origem[i]! + (alvo[i]! - origem[i]!) * junta;
      posicoes.needsUpdate = true;
      (particulas.current?.material as PointsMaterial | undefined)?.setValues({ opacity: 0.9 * (1 - suave(limitar((t - 0.75) / 0.25))) });
      m.opacity = suave(limitar((t - 0.55) / 0.45));
      // Os três pontos só aparecem junto com o volume do escudo.
      bolinhas.current.forEach((b) => b?.scale.setScalar(m.opacity));
      g.rotation.y = (1 - suave(t)) * 0.9;
    } else if (modo === "vivo") {
      const tempo = parado ? 0 : clock.elapsedTime;
      g.rotation.y = Math.sin(tempo * 0.5) * 0.45 + (parado ? 0 : pointer.x * 0.25);
      g.rotation.x = parado ? 0 : -pointer.y * 0.12;
      bolinhas.current.forEach((b, i) => b?.scale.setScalar(parado ? 1 : 1 + 0.22 * Math.sin(tempo * 3 - i * 0.7)));
    } else {
      const t = quadro ?? (parado ? 1 : limitar(decorrido / 2));
      // Começa devagar e acelera: o escudo fica reconhecível enquanto vem na direção da plateia.
      const avanco = t * t * (3 - 2 * t);
      g.scale.setScalar(0.03 * (1 + avanco * 5.5));
      g.rotation.y = (1 - avanco) * -0.5;
      // Brilha uma vez perto do fim e depois escurece, para a frase final ficar legível na frente.
      const brilho = Math.exp(-(((t - 0.8) / 0.12) ** 2));
      m.emissiveIntensity = 0.15 + brilho * 1.6;
      m.opacity = 1 - avanco * 0.72;
    }
  });

  return (
    <group ref={grupo} scale={0.03}>
      <mesh geometry={corpo}>
        <meshStandardMaterial ref={material} color={cores.azul} emissive={cores.azul} emissiveIntensity={0.15} roughness={0.35} metalness={0.15} transparent />
      </mesh>
      {modo !== "fechando" &&
        pontos.map((p, i) => (
          <mesh key={p.x} ref={(malha) => void (bolinhas.current[i] = malha)} position={[p.x, p.y, PROFUNDIDADE / 2 + 1.6]}>
            <sphereGeometry args={[p.r, 24, 24]} />
            {/* O terceiro ponto é ciano, como no logo. */}
            <meshStandardMaterial color={i === 2 ? cores.ciano : cores.branco} emissive={i === 2 ? cores.ciano : cores.branco} emissiveIntensity={i === 2 ? 0.7 : 0.25} />
          </mesh>
        ))}
      {modo === "formando" && (
        <points ref={particulas} geometry={nuvem}>
          <pointsMaterial color={cores.ciano} size={0.11} sizeAttenuation transparent depthWrite={false} />
        </points>
      )}
    </group>
  );
}

/** `?quadro=0.5` congela as cenas num ponto da animação (0 a 1): serve para conferir e ajustar o visual. */
const QUADRO = (() => {
  const valor = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("quadro");
  return valor === null || Number.isNaN(Number(valor)) ? null : limitar(Number(valor));
})();

export default function CenaEscudo({ modo, parado = false }: { modo: ModoCena; parado?: boolean }) {
  return (
    <>
      {/* offsetSize: o palco é escalado por CSS para caber no projetor; medir pelo tamanho de layout
          (e não pelo retângulo já escalado) mantém o canvas do tamanho certo em qualquer resolução. */}
      <Canvas className="cena" resize={{ offsetSize: true }} camera={{ position: [0, 0, 7], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} frameloop={parado || QUADRO !== null ? "demand" : "always"} aria-hidden="true">
      <ambientLight intensity={0.75} />
      {/* Luz lateral: é ela que faz o volume aparecer. */}
      <directionalLight position={[-4, 3, 5]} intensity={2.2} />
      <directionalLight position={[5, -2, 3]} intensity={0.5} color={cores.ciano} />
      <Escudo modo={modo} parado={parado} quadro={QUADRO} />
    </Canvas>
    </>
  );
}
