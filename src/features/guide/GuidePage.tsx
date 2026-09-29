import { navigate } from '../../app/router';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { RITUAL, TIPS } from './tips';

export function GuidePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Як вчитися з найбільшим ефектом</h1>
        <p className="mt-1 text-muted">
          Коротко про те, як працює памʼять і як отримати максимум від 15–20 хвилин на день.
        </p>
      </div>

      <Card className="border-accent/40 bg-accent/5">
        <h2 className="font-medium">Щоденний ритуал</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {RITUAL.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>

      <ol className="flex flex-col gap-3">
        {TIPS.map((tip, i) => (
          <li key={tip.title}>
            <Card>
              <h2 className="flex gap-2 font-medium">
                <span className="font-mono text-accent">{i + 1}.</span>
                {tip.title}
              </h2>
              <p className="mt-1.5">{tip.text}</p>
              <p className="mt-1.5 text-sm text-muted">
                <b className="font-medium">Чому:</b> {tip.why}
              </p>
            </Card>
          </li>
        ))}
      </ol>

      <Button variant="primary" size="lg" onClick={() => navigate('/')}>
        До занять
      </Button>
    </div>
  );
}
