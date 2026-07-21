import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Heading, Text, Button, Stack, useLocale } from '@mero-nepal/ui';

export default function Home() {
  const { t } = useLocale();
  // The heading is authored as one token with a "\n" where the line should
  // break, so translators control the split without hard-coding two keys.
  const titleLines = t('home.title').split('\n');

  return (
    <main className="page" style={{ paddingTop: '120px', paddingBottom: '120px', textAlign: 'center' }}>
      <Text
        weight="medium"
        color="var(--mero-colors-primary)"
        style={{ letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '16px' }}
      >
        {t('home.badge')}
      </Text>
      <Heading level={1} style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '20px' }}>
        {titleLines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </Heading>
      <Text size="lg" subtle style={{ maxWidth: '500px', margin: '0 auto 40px' }}>
        {t('home.subtitle')}
      </Text>
      <Stack direction="row" gap="12px" justify="center" wrap>
        <Button as={Link} to="/submit" size="lg">{t('home.ctaSubmit')}</Button>
        <Button as={Link} to="/track" variant="secondary" size="lg">{t('home.ctaTrack')}</Button>
      </Stack>
    </main>
  );
}
