"use client";

import { useState } from "react";

/** Foto do produto: o lugar já fica reservado, brilhando, até ela chegar. */
export function Foto({ url, className = "" }: { url: string; className?: string }) {
  const [pronta, setPronta] = useState(false);

  return (
    <span className={"relative block overflow-hidden " + className}>
      {!pronta && <span aria-hidden className="anim-brilho absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        onLoad={() => setPronta(true)}
        onError={() => setPronta(true)}
        className={
          "size-full object-cover transition-opacity duration-300 " +
          (pronta ? "opacity-100" : "opacity-0")
        }
      />
    </span>
  );
}
