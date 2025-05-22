<script lang="ts">
  const { playerTime, averageTime }: { playerTime: number; averageTime: number | null } = $props();

  // Logic to format times
  const formatTime = (timeMs: number | null | undefined): string | null => {
    if (timeMs === null || timeMs === undefined) return null;
    return (timeMs / 1000).toFixed(1);
  };

  const formattedPlayerTime = formatTime(playerTime);
  const formattedAverageTime = formatTime(averageTime);
</script>

<div>
  {#if formattedPlayerTime}
    <p>Your Time: {formattedPlayerTime}s</p>
  {/if}
  
  {#if averageTime && averageTime > 0 && formattedAverageTime}
    <p>Average Time: {formattedAverageTime}s</p>
  {:else}
    <p>Average time is not available yet.</p>
  {/if}
</div>

<style>
  div {
    padding: 1em;
    border: 1px solid #ccc;
    border-radius: 5px;
    text-align: center;
    font-family: sans-serif;
    margin-top: 1rem;
  }
  p {
    margin: 0.5em 0;
    font-size: 1.1em;
  }
</style>
