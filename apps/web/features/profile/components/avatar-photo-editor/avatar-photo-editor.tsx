"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/features/chat";
import { useAvatarUpload } from "@/features/profile/hooks/use-avatar-upload";
import { validateAvatarFile, type PixelCrop } from "@/features/profile/image/avatar-image";
import { cn } from "@/lib/utils";
import Cropper, { type Area, type CropperProps } from "react-easy-crop";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, type ComponentType, useEffect, useId, useRef, useState } from "react";
import type { AvatarCommandService } from "@/lib/services";

const EasyCropper = Cropper as unknown as ComponentType<CropperProps>;

interface AvatarPhotoEditorProps {
  enabled: boolean;
  userId: string;
  displayName: string;
  currentAvatarUrl: string | null;
  hasAvatar: boolean;
  commands?: AvatarCommandService;
}

const stageLabels = {
  preparing: "Preparing photo",
  authorizing: "Getting the upload ready",
  uploading: "Uploading photo",
  processing: "Finishing photo",
} as const;

export function AvatarPhotoEditor({
  enabled,
  userId,
  displayName,
  currentAvatarUrl,
  hasAvatar,
  commands,
}: AvatarPhotoEditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();
  const fileInputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const upload = useAvatarUpload(commands);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    try {
      setSelectionNotice(null);
      await validateAvatarFile(selected);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPixelCrop(null);
      upload.markSelected();
    } catch (error) {
      setSelectionNotice(error instanceof Error ? error.message : "We could not read that photo.");
    }
  }

  function handleCropComplete(_area: Area, areaPixels: Area) {
    setPixelCrop(areaPixels);
  }

  async function savePhoto() {
    if (!file || !pixelCrop) return;
    const saved = await upload.save(file, pixelCrop);
    if (saved) {
      router.push("/profile");
      router.refresh();
    }
  }

  async function removePhoto() {
    const removed = await upload.remove();
    if (removed) {
      router.push("/profile");
      router.refresh();
    }
  }

  async function chooseAnother() {
    await upload.cancel();
    inputRef.current?.click();
  }

  if (!enabled) {
    return (
      <div className="flex flex-col gap-md">
        <Alert tone="notice">Avatar updates are resting for a moment. Try again later.</Alert>
        <Link href="/profile" className={buttonVariants({ variant: "ghost", fullWidth: true })}>
          Back to profile
        </Link>
      </div>
    );
  }

  const stage = upload.status in stageLabels
    ? stageLabels[upload.status as keyof typeof stageLabels]
    : null;

  return (
    <Card className="w-full max-w-form">
      <h1 className="text-heading-sm">Profile photo</h1>
      <p id={instructionsId} className="mt-xs text-ui-sm text-body">
        Move the photo with touch, drag, or the arrow keys. Use zoom only if you need it.
      </p>

      <label htmlFor={fileInputId} className="sr-only">Choose profile photo</label>
      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={selectFile}
        aria-describedby={instructionsId}
      />

      {!previewUrl ? (
        <div className="mt-lg flex flex-col items-center gap-md">
          <Avatar
            profileId={userId}
            src={currentAvatarUrl ?? undefined}
            name={displayName}
            size="lg"
            alt=""
          />
          <Button
            variant="primary"
            fullWidth
            aria-controls={fileInputId}
            onClick={() => inputRef.current?.click()}
          >
            Choose photo
          </Button>
          {hasAvatar && (
            <Button variant="ghost" fullWidth onClick={removePhoto} loading={upload.busy}>
              Remove current photo
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-lg flex flex-col gap-md">
          <div className="relative aspect-square w-full overflow-hidden rounded-card bg-surface-2">
            <EasyCropper
              image={previewUrl}
              crop={crop}
              zoom={zoom}
              rotation={0}
              aspect={1}
              minZoom={1}
              maxZoom={3}
              cropShape="round"
              showGrid={false}
              zoomSpeed={1}
              style={{}}
              classes={{}}
              restrictPosition
              mediaProps={{ alt: "" }}
              keyboardStep={4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              cropperProps={{
                "aria-label": "Reposition profile photo",
                "aria-describedby": instructionsId,
              }}
            />
          </div>
          <label className="flex min-h-control flex-col justify-center gap-2xs text-ui-sm text-foreground">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="min-h-control w-full cursor-pointer accent-primary"
              disabled={upload.busy}
            />
          </label>
          {stage && (
            <Progress value={upload.progress * 100} label={stage} />
          )}
          <p aria-live="polite" className="min-h-field-message text-ui-sm text-notice">
            {selectionNotice ?? upload.notice ?? stage ?? ""}
          </p>
          <Button
            variant="primary"
            fullWidth
            loading={upload.busy}
            disabled={!pixelCrop}
            onClick={savePhoto}
          >
            Save photo
          </Button>
          <Button variant="secondary" fullWidth disabled={upload.busy} onClick={chooseAnother}>
            Choose another photo
          </Button>
        </div>
      )}

      {!previewUrl && (selectionNotice || upload.notice) && (
        <p aria-live="polite" className="mt-sm min-h-field-message text-ui-sm text-notice">
          {selectionNotice ?? upload.notice}
        </p>
      )}
      <Link
        href="/profile"
        className={cn(buttonVariants({ variant: "ghost", fullWidth: true }), "mt-sm")}
      >
        Back to profile
      </Link>
    </Card>
  );
}
