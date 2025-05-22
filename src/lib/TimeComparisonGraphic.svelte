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

<div class="graphic-container">
  <p>Your Time: {formattedPlayerTime}s</p>
  {#if formattedAverageTime && averageTime && averageTime > 0}
    <p>Average Time: {formattedAverageTime}s</p>
  {:else}
    <p>Average time is not available yet.</p>
  {/if}
</div>

<style>
  .graphic-container {
    text-align: center;
    /* Removed padding, border, border-radius, font-family, margin-top */
  }
  p {
    margin: 0.6em 0; /* Slightly adjusted margin for better spacing */
    font-size: 1.1rem; /* Increased font size */
    color: #f0f0f0; /* Ensuring good contrast on dark modal */
  }
</style>
