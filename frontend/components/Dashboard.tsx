"use client";

import { useState } from "react";

import { FolderIcon, UploadIcon } from "@/components/ui/Icons";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { ViewPanel } from "@/components/view/ViewPanel";

type ParentTab = "upload" | "view";

export function Dashboard() {
  const [tab, setTab] = useState<ParentTab>("upload");
  return (
    <div className="space-y-6">
      <Tabs<ParentTab>
        ariaLabel="Main sections"
        idPrefix="main"
        value={tab}
        onChange={setTab}
        items={[
          { id: "upload", label: "Upload Docs", icon: <UploadIcon width={18} height={18} /> },
          { id: "view", label: "View Docs", icon: <FolderIcon width={18} height={18} /> },
        ]}
      />
      <TabPanel idPrefix="main" id={tab}>
        {tab === "upload" ? <UploadPanel /> : <ViewPanel />}
      </TabPanel>
    </div>
  );
}
