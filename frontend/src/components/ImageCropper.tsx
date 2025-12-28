import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import getCroppedImg from '../utils/cropImage';

interface Props {
  imageSrc: string;
  aspect?: number;
  onCancel: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const ImageCropper: React.FC<Props> = ({ imageSrc, aspect, onCancel, onCropComplete }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget
      setCrop(centerAspectCrop(width, height, aspect))
    } else {
        // Default full crop if no aspect
        setCrop({
            unit: '%',
            width: 90,
            height: 90,
            x: 5,
            y: 5
        })
    }
  }

  const showCroppedImage = useCallback(async () => {
    try {
      if (completedCrop && imgRef.current) {
        // Use the original image dimensions relative to the displayed image
        // ReactCrop returns pixel values relative to the displayed image
        // But getCroppedImg might expect something else or we pass the displayed image?
        // Actually getCroppedImg takes imageSrc.
        // And pixelCrop.
        // But pixelCrop from ReactCrop is based on the *rendered* image size.
        // We need to scale it to natural size if getCroppedImg loads a new Image().
        
        // Wait, getCroppedImg creates a new Image(imageSrc).
        // So we need to scale the crop coordinates.
        
        const image = imgRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        const scaledCrop = {
            x: completedCrop.x * scaleX,
            y: completedCrop.y * scaleY,
            width: completedCrop.width * scaleX,
            height: completedCrop.height * scaleY
        };

        const croppedBlob = await getCroppedImg(imageSrc, scaledCrop);
        if (croppedBlob) {
          onCropComplete(croppedBlob);
        }
      } else {
        // If no crop interaction, maybe return original? Or alert?
        // If free crop, user might not have moved it.
        // But we initialized it.
      }
    } catch (e) {
      console.error(e);
    }
  }, [imageSrc, completedCrop, onCropComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Crop Logo</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-4 rounded">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            className="max-h-full"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageSrc}
              onLoad={onImageLoad}
              style={{ maxHeight: '70vh', objectFit: 'contain' }}
            />
          </ReactCrop>
        </div>

        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={showCroppedImage}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
