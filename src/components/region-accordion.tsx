"use client";

import { useState, useMemo } from "react";
import RegionSection from "@/components/region-section";

interface RegionData {
  id: number;
  name: string;
  totalListings: number;
  newCount: number;
  deactivatedCount: number;
  newListings: Parameters<typeof RegionSection>[0]["newListings"];
  deactivatedListings: Parameters<typeof RegionSection>[0]["deactivatedListings"];
}

export default function RegionAccordion({
  regions,
  propertyLabels,
  tradeLabels,
  starredIdList,
}: {
  regions: RegionData[];
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
  starredIdList: number[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const starredIds = useMemo(() => new Set(starredIdList), [starredIdList]);

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {regions.map((region) => (
        <RegionSection
          key={region.id}
          name={region.name}
          totalListings={region.totalListings}
          newCount={region.newCount}
          deactivatedCount={region.deactivatedCount}
          newListings={region.newListings}
          deactivatedListings={region.deactivatedListings}
          propertyLabels={propertyLabels}
          tradeLabels={tradeLabels}
          starredIds={starredIds}
          collapsed={!expandedIds.has(region.id)}
          onToggle={() => toggle(region.id)}
        />
      ))}
    </div>
  );
}
