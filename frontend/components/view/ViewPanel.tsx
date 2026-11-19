"use client";

import { useState } from "react";

import { FileTextIcon, ImageIcon } from "@/components/ui/Icons";
import { TabPanel, Tabs } from "@/components/ui/Tabs";

import { EdiDocumentList } from "./EdiDocumentList";
import { EobGallery } from "./EobGallery";

type SubTab = "edi_837" | "eob_835";

export function ViewPanel() {
  const [tab, setTab] = useState<SubTab>("edi_837");
  return (
    <div className="space-y-5">
      <Tabs<SubTab>
        ariaLabel="Document type"
        idPrefix="view"
        variant="secondary"
        value={tab}
        onChange={setTab}
        items={[
          { id: "edi_837", label: "837 EDI (txt)", icon: <FileTextIcon width={16} height={16} /> },
          { id: "eob_835", label: "835 EOB (image)", icon: <ImageIcon width={16} height={16} /> },
        ]}
      />
      <TabPanel idPrefix="view" id={tab}>
        {tab === "edi_837" ? <EdiDocumentList /> : <EobGallery />}
      </TabPanel>
    </div>
  );
}
