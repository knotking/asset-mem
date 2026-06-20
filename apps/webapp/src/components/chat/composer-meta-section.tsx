"use client";

type ComposerMetaSectionProps = {
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
};

export function ComposerMetaSection({
  contextChipStrip,
  sendBlockHint,
}: ComposerMetaSectionProps) {
  if (!contextChipStrip && !sendBlockHint) {
    return null;
  }

  return (
    <div className="space-y-1">
      {contextChipStrip}
      {sendBlockHint ? (
        <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
      ) : null}
    </div>
  );
}
