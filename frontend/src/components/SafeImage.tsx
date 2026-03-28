import React from 'react';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  onErrorBehavior?: 'hide' | 'none';
};

const SafeImage: React.FC<SafeImageProps> = ({ onErrorBehavior = 'hide', onError, ...props }) => {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (onError) {
      onError(e);
      return;
    }
    if (onErrorBehavior === 'hide') {
      e.currentTarget.style.display = 'none';
    }
  };

  return <img {...props} onError={handleError} />;
};

export default SafeImage;
