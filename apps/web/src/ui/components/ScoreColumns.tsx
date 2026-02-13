export interface ScoreColumnsProps {
  id: string;
  className?: string;
}

export function ScoreColumns({ id, className = "score-columns" }: ScoreColumnsProps) {
  return <div id={id} className={className} />;
}
