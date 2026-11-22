
import { useMemo } from "react";
import jerseyColorsRaw from "../../../engine/nations/data/jersey_colors.json";

type JerseyConfig = {
  primary: string;
  secondary: string;
  text: string;
  style: string;
};

type NationJerseyConfig = {
  home: JerseyConfig;
  away: JerseyConfig;
  third?: JerseyConfig;
};

const jerseyColors = jerseyColorsRaw as Record<string, NationJerseyConfig>;

const jerseyPatterns = import.meta.glob(
  "../../../images/jersey_patterns/*.svg",
  {
    eager: true,
    query: "?raw",
    import: "default"
  }
) as Record<string, string>;

function getJerseySvg(config: JerseyConfig): string | null {
  const path = `../../../images/jersey_patterns/${config.style}.svg`;
  const source = jerseyPatterns[path];

  if (!source) return null;

  return source
    .replace(/#1c9551/gi, config.primary)
    .replace(/#ff7f2a/gi, config.secondary);
}

function JerseyPreview({ config }: { config: JerseyConfig }) {
  const imageUrl = useMemo(() => {
    const svg = getJerseySvg(config);

    return svg
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      : null;
  }, [config]);

  if (!imageUrl) return null;

  return (
    <div className="relative w-[125px] aspect-[55.4532/69.7485] rounded-lg overflow-hidden border border-navy-700">
      <img
        src={imageUrl}
        alt="Jersey"
        className="absolute inset-0 w-full h-full object-contain"
      />

      <svg
        viewBox="0 0 55.4532 69.7485"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <text
          x="27.73"
          y="50"
          textAnchor="middle"
          fontFamily="VarsityBold, sans-serif"
          fontSize="40"
          fontWeight="500"
          fill={config.text}
          stroke={config.primary}
          strokeWidth="2"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          10
        </text>
      </svg>
    </div>
  );
}

export default function NationKits({ code }: { code: string }) {
  const kits = jerseyColors[code];

  if (!kits) {
    return (
      <div className="text-center text-sm text-navy-300 py-8">
        No jersey configurations available.
      </div>
    );
  }

  const availableKits = [
    { label: "Home", config: kits.home },
    { label: "Away", config: kits.away },
    ...(kits.third ? [{ label: "Third", config: kits.third }] : [])
  ];

  return (
    <div className="flex flex-nowrap justify-center items-center overflow-x-auto min-w-0 gap-6 p-8">
      {availableKits.map(({ label, config }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <JerseyPreview config={config} />

          <span className="text-xs font-semibold uppercase tracking-wide text-navy-200">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
