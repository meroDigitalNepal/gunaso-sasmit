import { Link } from 'react-router-dom';
import { Heading, Text, Button, Stack } from '@mero-nepal/ui';

export default function Home() {
  return (
    <main className="page" style={{ paddingTop: '120px', paddingBottom: '120px', textAlign: 'center' }}>
      <Text
        weight="medium"
        color="var(--mero-colors-primary)"
        style={{ letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '16px' }}
      >
        Civic Feedback Platform
      </Text>
      <Heading level={1} style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '20px' }}>
        Your voice,<br />delivered to your representative.
      </Heading>
      <Text size="lg" subtle style={{ maxWidth: '500px', margin: '0 auto 40px' }}>
        Submit questions and complaints to your representative's team. Track progress. Get answers.
      </Text>
      <Stack direction="row" gap="12px" justify="center" wrap>
        <Button as={Link} to="/submit" size="lg">Submit a request</Button>
        <Button as={Link} to="/track" variant="secondary" size="lg">Track my request</Button>
      </Stack>
    </main>
  );
}
