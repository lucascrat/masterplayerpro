import { useState } from 'react';

interface PosterImageProps {
  src: string;
  alt: string;
  placeholder?: string;
}

export default function PosterImage({ src, alt, placeholder = '🎬' }: PosterImageProps) {
  const [failed, setFailed] = useState(false);
  const [landscape, setLandscape] = useState(false);

  if (failed || !src) {
    return <span className="placeholder">{placeholder}</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => {
        const img = e.currentTarget;
        // If image is significantly wider than tall, use contain
        if (img.naturalWidth > img.naturalHeight * 1.2) {
          setLandscape(true);
        }
      }}
      onError={() => setFailed(true)}
      style={landscape ? { objectFit: 'contain', background: '#111' } : undefined}
    />
  );
}
