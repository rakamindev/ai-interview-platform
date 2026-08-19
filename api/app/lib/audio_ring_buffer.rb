# frozen_string_literal: true

# Fixed-size circular buffer for raw PCM audio frames.
#
# Stores timestamped chunks so a precise time-range slice can be replayed
# after a Gemini Live reconnection. Capacity is enforced by byte count — older
# chunks are evicted automatically when the buffer is full.
#
# Thread safety: NOT thread-safe by design. Intended for exclusive use within
# the EventMachine reactor thread where all audio callbacks run.
class AudioRingBuffer
  # 60 seconds at 16kHz 16-bit mono = 32KB/s × 60 = ~1.92MB per session
  DEFAULT_CAPACITY_SECONDS = 60
  BYTES_PER_SECOND = 32_000

  Chunk = Struct.new(:timestamp, :data)

  def initialize(capacity_seconds: DEFAULT_CAPACITY_SECONDS)
    @capacity_bytes = capacity_seconds * BYTES_PER_SECOND
    @chunks = []
    @total_bytes = 0
  end

  # Appends a PCM audio chunk. Evicts oldest chunks if over capacity.
  def push(pcm_bytes, timestamp: monotonic_now)
    chunk = Chunk.new(timestamp: timestamp, data: pcm_bytes.dup.freeze)
    @chunks.push(chunk)
    @total_bytes += pcm_bytes.bytesize
    evict_oldest while @total_bytes > @capacity_bytes
  end

  # Returns all Chunk structs with timestamp >= since_timestamp, in order.
  def since(since_timestamp)
    @chunks.select { |c| c.timestamp >= since_timestamp }
  end

  # Total bytes currently buffered.
  def size
    @total_bytes
  end

  # Number of chunks currently buffered.
  def count
    @chunks.length
  end

  def clear
    @chunks.clear
    @total_bytes = 0
  end

  private

  def evict_oldest
    return if @chunks.empty?

    removed = @chunks.shift
    @total_bytes -= removed.data.bytesize
  end

  def monotonic_now
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end
end
