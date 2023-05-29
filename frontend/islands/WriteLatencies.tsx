import { useState } from "preact/hooks";

export default function WriteLatencies() {
  const [count, setCount] = useState(0);

  return (
    <div>
      Counter is at {count}.{" "}
      <button onClick={() => setCount(count + 1)}><span>+</span></button>
      <div>who knows</div>
    </div>
  );
}
