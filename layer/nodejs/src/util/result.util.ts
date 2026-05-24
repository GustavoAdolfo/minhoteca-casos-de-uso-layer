import {
  AutorDTO,
  EditoraDTO,
  LivroDTO,
  PageDataType,
  PaisDTO,
} from '@gustavoadolfo/minhoteca-core-layer';

export const createResult = (
  data: LivroDTO[] | PaisDTO[] | AutorDTO[] | EditoraDTO[] | undefined,
  code: number,
  message?: string,
  params?: {
    totalItems?: number;
    totalPages?: number;
    page?: number;
    nextPage?: string;
    prevPage?: string;
  }
): PageDataType => {
  return {
    PageData: data,
    Items: data?.length ?? 0,
    TotalItems: params?.totalItems ?? data?.length ?? 0,
    TotalPage: params?.totalPages ?? 1,
    Page: params?.page ?? 1,
    NextPage: params?.nextPage,
    PreviousPage: params?.prevPage,
    Code: code,
    Message: message,
  };
};
