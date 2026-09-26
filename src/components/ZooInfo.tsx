import { ZOO_HABITATS } from '../lib/zoo';

export default function ZooInfo({ minutes, watching }: { minutes: number; watching: number }) {
  return (
    <div className="venue-info">
      <span className="quiet-label">PUBLIC SPACE · O4–R9 · 24 PLOTS</span>
      <div className="venue-program">
        <span className="eyebrow">
          {minutes >= 840 && minutes < 1020
            ? 'AN AFTERNOON WITH THE ANIMALS'
            : 'A WILD LITTLE CORNER OF TOWN'}
        </span>
        <h3>Welcome to Willow Grove Zoo.</h3>
        <p>
          Four animal habitats, shady paths, and room to grow. Meet the animals each town day from
          14:00–17:00.
        </p>
        <p className="muted-copy">
          Little surprises happen roughly every two minutes in each habitat, with quiet wandering in
          between. {watching} neighbors watching. Visitors plan their trip from home; those further
          away set out earlier when their routine allows, or take the tube when it saves time.
        </p>
      </div>
      {ZOO_HABITATS.map((habitat, index) => (
        <div className="venue-program" key={habitat.id}>
          <span className="eyebrow">
            HABITAT {index + 1} ·{' '}
            {habitat.animal ? 'MEET THE NEIGHBORS' : 'RESERVED FOR THE FUTURE'}
          </span>
          <h3>{habitat.name}</h3>
          <p>
            {habitat.animal
              ? {
                  giraffe:
                    'Watch for the very stretchy snack: a tall neck, a leafy mouthful, and a happy head wobble.',
                  elephant:
                    'Every so often, one elephant drinks from the pond and gives itself a magnificent trunk shower.',
                  zebra:
                    'Mostly grazing. Occasionally overcome by the zoomies: two quick laps and a dusty stop.',
                  penguin:
                    'Taking turns at the pool: a little crouch, a big jump, a splash, and a swim.',
                }[habitat.animal]
              : 'A planted, empty enclosure, ready for a new animal species one day.'}
          </p>
        </div>
      ))}
    </div>
  );
}
