import { useState } from 'react';

interface PosterImageProps {
  src: string;
  alt: string;
}

export default function PosterImage({ src, alt }: PosterImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <span className="placeholder">🎬</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
