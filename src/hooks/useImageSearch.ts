import { useMutation } from "@tanstack/react-query";
import type * as ImagePicker from "expo-image-picker";
import { requestImageSearch } from "../lib/api/imageSearch";

export function useUploadImageSearch() {
  return useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => requestImageSearch(asset)
  });
}
