interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const iconSize = size === 'large' ? 120 : size === 'medium' ? 80 : 40;
  const fontSize = size === 'large' ? '3rem' : size === 'medium' ? '2rem' : '1rem';
  const borderRadius = size === 'large' ? 24 : size === 'medium' ? 18 : 8;

  return (
    <div className="logo-container">
      <div 
        className="logo-icon" 
        style={{ 
          width: iconSize, 
          height: iconSize, 
          fontSize: fontSize,
          borderRadius: borderRadius
        }} 
      />
      {showText && (
        <div className="logo-text" style={{ fontSize: size === 'large' ? '1.8rem' : '1.3rem' }}>
          <span className="highlight">krator</span>+
        </div>
      )}
    </div>
  );
}
