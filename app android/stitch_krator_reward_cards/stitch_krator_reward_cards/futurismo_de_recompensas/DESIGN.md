---
name: Futurismo de Recompensas
colors:
  surface: '#150e2e'
  surface-dim: '#150e2e'
  surface-bright: '#3c3457'
  surface-container-lowest: '#100829'
  surface-container-low: '#1e1637'
  surface-container: '#221a3b'
  surface-container-high: '#2c2546'
  surface-container-highest: '#373052'
  on-surface: '#e7deff'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e7deff'
  inverse-on-surface: '#332b4d'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#ffe083'
  on-secondary: '#3c2f00'
  secondary-container: '#eec200'
  on-secondary-container: '#645000'
  tertiary: '#ffb0cd'
  on-tertiary: '#640039'
  tertiary-container: '#f751a1'
  on-tertiary-container: '#570032'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#ffe083'
  secondary-fixed-dim: '#eec200'
  on-secondary-fixed: '#231b00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffd9e4'
  tertiary-fixed-dim: '#ffb0cd'
  on-tertiary-fixed: '#3e0022'
  on-tertiary-fixed-variant: '#8c0053'
  background: '#150e2e'
  on-background: '#e7deff'
  surface-variant: '#373052'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  section-gap: 40px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

Este sistema de design foi concebido para evocar uma sensação de exclusividade tecnológica e entusiasmo gamificado. A personalidade da marca é vibrante, audaciosa e futurista, focada em transformar a experiência de acumular recompensas em uma jornada visualmente estimulante. 

O estilo visual adotado é o **Glassmorphism combinado com Neon Glows**. Utilizamos superfícies translúcidas que parecem flutuar sobre um abismo de roxo profundo, criando uma hierarquia baseada em profundidade e luminescência. A interface deve passar a sensação de um dispositivo de alta tecnologia ("cutting-edge"), onde cada interação é acompanhada por um feedback visual brilhante e fluido. O objetivo é criar um ambiente "premium dark" onde as moedas de ouro se destacam como tesouros digitais.

## Colors

A paleta de cores é dominada pelo **Roxo Vibrante (Vivid Violet)**, que serve como a fundação espiritual da interface. O fundo não é um preto absoluto, mas sim um roxo ultra-escuro para manter a coesão cromática mesmo nas sombras.

- **Primária (Roxo):** Utilizada para ações principais, ícones de marca e elementos estruturais de destaque. Possui variantes neon para estados ativos.
- **Secundária (Amarelo Ouro):** Reservada exclusivamente para moedas, pontos, recompensas e momentos de celebração ("Moedas Amarelas"). Ela deve brilhar intensamente contra o fundo escuro.
- **Acentuação (Rosa Neon):** Usada com parcimônia para badges de raridade ou alertas de bônus.
- **Neutros:** Tons de cinza azulado e lavanda pálida para textos secundários, garantindo legibilidade sem quebrar o clima noturno.

## Typography

A tipografia utiliza exclusivamente a **Space Grotesk**. Esta escolha reforça a estética técnica e futurista do sistema. 

As manchetes (Headlines) devem ser robustas e ligeiramente condensadas no espaçamento entre letras para um visual mais agressivo e moderno. O corpo do texto mantém uma clareza excepcional, enquanto os rótulos (Labels) utilizam variações em caixa alta (uppercase) com maior espaçamento para denotar seções de navegação e categorias de recompensas. A hierarquia é estabelecida principalmente pelo peso da fonte e pelo uso estratégico de cores neon em palavras-chave.

## Layout & Spacing

O sistema de layout é baseado em uma **grade fluida de 8 pixels**, garantindo que todos os elementos escalem proporcionalmente. 

- **Margens:** Utilizamos margens laterais de 24px em dispositivos móveis para dar "ar" aos elementos de vidro.
- **Ritmo Vertical:** O espaçamento entre seções de recompensas é amplo (40px) para permitir que os efeitos de brilho (glow) não se sobreponham de forma confusa.
- **Grids de Cards:** Os cards de recompensas seguem um modelo de duas colunas em dispositivos móveis ou um grid horizontal (carousel) para manter o foco na progressão do usuário.

## Elevation & Depth

A profundidade neste sistema não é ditada por sombras pretas tradicionais, mas por **camadas de iluminação e transparência**.

1.  **Backdrop Blur:** Superfícies elevadas utilizam um desfoque de fundo (backdrop-filter) de 12px a 20px, com uma opacidade de preenchimento entre 5% e 15%.
2.  **Bordas de Vidro:** Cada card possui uma borda sutil de 1px no topo e na esquerda (simulando luz incidente) com opacidade mais alta que o resto da superfície.
3.  **Neon Glow:** Elementos de alta prioridade, como o saldo de moedas amarelas e botões de resgate, emitem um "Outer Glow". Este brilho deve usar a cor da própria fonte ou ícone com um raio de desfoque de 15px a 30px e baixa opacidade (20-40%).
4.  **Z-Index:** O conteúdo flutuante deve parecer estar em uma camada de vidro distinta, acima do gradiente de fundo roxo.

## Shapes

As formas são **Rounded (Arredondadas)** para suavizar a estética tecnológica e torná-la mais amigável ao usuário. 

- **Cards e Modais:** Utilizam o padrão `rounded-xl` (1.5rem / 24px) para criar uma estética moderna de "bolha de vidro".
- **Botões:** Seguem o padrão `rounded-lg` (1rem / 16px) ou, em casos específicos de botões pequenos, `pill-shaped` para máxima distinção.
- **Inputs:** Mantêm o arredondamento de 12px para consistência com os elementos de controle.

## Components

**Buttons:**
- **Primary:** Fundo roxo vibrante com um leve gradiente linear, texto branco e um brilho externo (neon glow) roxo constante.
- **Secondary (Resgate):** Cor amarela sólida, tipografia em preto/roxo escuro para contraste, usado exclusivamente para funções ligadas a moedas.

**Cards (Recompensas):**
- Devem usar o efeito de glassmorphism. O título da recompensa em branco e o valor em amarelo neon. Incluem uma borda interna sutil para destacar a elevação.

**Moedas (Coins):**
- Ícones de moedas devem ser renderizados com um leve gradiente dourado e um filtro de brilho. Movimentos de "moedas caindo" ou contadores numéricos devem usar a cor amarela (#FACC15).

**Progress Bars:**
- Fundo em roxo ultra-escuro (quase preto) com a barra de progresso em gradiente de Roxo para Rosa. Se a meta for de moedas, a barra assume o tom amarelo.

**Inputs:**
- Campos de texto translúcidos com bordas que se tornam roxas neon quando focadas. O texto de placeholder deve ser lavanda desbotado.

**Chips/Tags:**
- Pequenos elementos para categorias (ex: "Premium", "Expirando"). Usar fundo sólido roxo com baixa opacidade e texto em tom pastel para não competir com as ações principais.