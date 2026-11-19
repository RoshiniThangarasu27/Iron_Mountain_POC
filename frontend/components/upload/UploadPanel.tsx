import { DocTypeNote } from "@/components/DocTypeNote";
import { FileTextIcon, ImageIcon } from "@/components/ui/Icons";

import { UploadCard } from "./UploadCard";

export function UploadPanel() {
  return (
    <div className="space-y-6">
      <DocTypeNote />
      <div className="grid gap-6 lg:grid-cols-2">
        <UploadCard
          docType="edi_837"
          title="837 EDI files"
          subtitle="X12 837 health care claims (plain text)"
          extensions={[".txt", ".edi", ".x12", ".dat"]}
          acceptMime={["text/plain"]}
          icon={<FileTextIcon />}
          accent="teal"
        />
        <UploadCard
          docType="eob_835"
          title="EOB / 835 images"
          subtitle="Explanation of Benefits / remittance page images"
          extensions={[".png", ".jpg", ".jpeg", ".webp"]}
          acceptMime={["image/png", "image/jpeg", "image/webp"]}
          icon={<ImageIcon />}
          accent="indigo"
        />
      </div>
    </div>
  );
}
