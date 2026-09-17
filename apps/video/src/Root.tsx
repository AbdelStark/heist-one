import { Composition, Still } from "remotion";
import { HeistOneLaunch, HeistOneThumbnail } from "./Video";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 1104;

export const RemotionRoot = (): React.JSX.Element => (
  <>
    <Composition
      id="HeistOneLaunch"
      component={HeistOneLaunch}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Still id="HeistOneThumbnail" component={HeistOneThumbnail} width={WIDTH} height={HEIGHT} />
  </>
);
