export function ProductHuntBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.producthunt.com/products/alpha-brain?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-alpha-brain"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <img
        alt="Alpha Brain  - STOCK , CRYPTO | Product Hunt"
        width={250}
        height={54}
        loading="lazy"
        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1199306&theme=light&t=1785662906182"
      />
    </a>
  );
}
