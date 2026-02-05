import React from "react";
import { FaTag } from "react-icons/fa";
import SectionCard from "./SectionCard";
import TagBadge from "./TagBadge";

const PopularTags = ({ tags = [] }) => {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <FaTag className="w-4 h-4 text-warning-600 dark:text-warning-400" />
          Etiquetas Populares
        </span>
      }
    >
      <div className="p-6">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.name} tag={tag} />
          ))}
        </div>
      </div>
    </SectionCard>
  );
};

export default PopularTags;
