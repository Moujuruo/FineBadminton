for file in benchmark/video/*.mp4; do
  # Get the base filename without the path
  filename=$(basename "$file")
  # Re-encode and place in the new directory
  ffmpeg -i "$file" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "benchmark/video_reencoded/$filename"
done
