const MAX_PHOTO_DATA_URL_LENGTH = 135000;

export async function compressProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const srcWidth = img.naturalWidth || img.width;
      const srcHeight = img.naturalHeight || img.height;
      if (!srcWidth || !srcHeight) {
        reject(new Error('Não foi possível ler as dimensões desta foto.'));
        return;
      }

      // Square center crop
      const cropSize = Math.min(srcWidth, srcHeight);
      const sx = Math.floor((srcWidth - cropSize) / 2);
      const sy = Math.floor((srcHeight - cropSize) / 2);

      const attemptExport = (targetPx: number, quality: number): string | null => {
        const canvas = document.createElement('canvas');
        canvas.width = targetPx;
        canvas.height = targetPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetPx, targetPx);
        ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, targetPx, targetPx);
        return canvas.toDataURL('image/jpeg', quality);
      };

      const tries: Array<[number, number]> = [
        [240, 0.8],
        [240, 0.65],
        [200, 0.6],
        [160, 0.55],
      ];

      for (const [px, q] of tries) {
        const dataUrl = attemptExport(px, q);
        if (dataUrl && dataUrl.length <= MAX_PHOTO_DATA_URL_LENGTH) {
          resolve(dataUrl);
          return;
        }
      }

      reject(
        new Error(
          'A foto selecionada ficou muito grande mesmo após redução. Tente outra imagem.',
        ),
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar esta foto de perfil.'));
    };

    img.src = objectUrl;
  });
}
