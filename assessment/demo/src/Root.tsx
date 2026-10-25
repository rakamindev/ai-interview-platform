import { Composition, Series, useVideoConfig } from 'remotion';
import { Opening } from './Opening';
import { Baseline } from './Baseline';
import { Workflow } from './Workflow';
import { Evidence } from './Evidence';
import { Recovery } from './Recovery';
import { Verification } from './Verification';
import { Closing } from './Closing';

const Walkthrough = () => {
  const { fps } = useVideoConfig();
  return <Series>
    <Series.Sequence name="Problem" durationInFrames={20 * fps} premountFor={fps}><Opening /></Series.Sequence>
    <Series.Sequence name="Baseline defect" durationInFrames={25 * fps} premountFor={fps}><Baseline /></Series.Sequence>
    <Series.Sequence name="Real workflow" durationInFrames={35 * fps} premountFor={fps}><Workflow /></Series.Sequence>
    <Series.Sequence name="Evidence and provenance" durationInFrames={35 * fps} premountFor={fps}><Evidence /></Series.Sequence>
    <Series.Sequence name="Failure recovery" durationInFrames={30 * fps} premountFor={fps}><Recovery /></Series.Sequence>
    <Series.Sequence name="Verification" durationInFrames={35 * fps} premountFor={fps}><Verification /></Series.Sequence>
    <Series.Sequence name="Trade-offs" durationInFrames={30 * fps} premountFor={fps}><Closing /></Series.Sequence>
  </Series>;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ReviewWalkthrough" component={Walkthrough} durationInFrames={3150} fps={15} width={1920} height={1080} />
      <Composition id="Opening" component={Opening} durationInFrames={300} fps={15} width={1920} height={1080} />
      <Composition id="Baseline" component={Baseline} durationInFrames={375} fps={15} width={1920} height={1080} />
      <Composition id="Workflow" component={Workflow} durationInFrames={525} fps={15} width={1920} height={1080} />
      <Composition id="Evidence" component={Evidence} durationInFrames={525} fps={15} width={1920} height={1080} />
      <Composition id="Recovery" component={Recovery} durationInFrames={450} fps={15} width={1920} height={1080} />
      <Composition id="Verification" component={Verification} durationInFrames={525} fps={15} width={1920} height={1080} />
      <Composition id="Closing" component={Closing} durationInFrames={450} fps={15} width={1920} height={1080} />
    </>
  );
};
