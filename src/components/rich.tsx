/** Renders product copy, raising every ™ and ®. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/([™®])/);
  return (
    <>
      {parts.map((part, index) =>
        part === "™" || part === "®" ? (
          <sup key={index} className="tm">
            {part}
          </sup>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
