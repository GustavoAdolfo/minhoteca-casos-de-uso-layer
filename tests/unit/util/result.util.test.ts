import { createResult } from '../../../layer/nodejs/src/util';
import { EditoraDTO, PageDataType } from '@gustavoadolfo/minhoteca-core-layer';

describe('Result Util - createResult', () => {
  // Mock básico de um DTO para usar nos testes
  const mockEditoraDTO = {
    id: '1234567890',
    nome: 'Editora Teste',
    email: 'teste@editora.com',
    website: 'http://editora.com',
    pais: 'BRA',
  } as EditoraDTO;

  it('deve criar um resultado com um array de dados e calcular Items/TotalItems automaticamente', () => {
    const data = [mockEditoraDTO, mockEditoraDTO];
    const result: PageDataType = createResult(data, 200, 'Sucesso');

    expect(result).toEqual({
      PageData: data,
      Items: 2,
      TotalItems: 2,
      TotalPage: 1,
      Page: 1,
      NextPage: undefined,
      PreviousPage: undefined,
      Code: 200,
      Message: 'Sucesso',
    });
  });

  it('deve lidar corretamente com dados enviados como um array vazio', () => {
    const data: EditoraDTO[] = [];
    const result: PageDataType = createResult(data, 200);

    expect(result).toEqual({
      PageData: data,
      Items: 0,
      TotalItems: 0,
      TotalPage: 1,
      Page: 1,
      NextPage: undefined,
      PreviousPage: undefined,
      Code: 200,
      Message: undefined,
    });
  });

  it('deve lidar corretamente quando os dados não forem informados (undefined)', () => {
    const result: PageDataType = createResult(undefined, 404, 'Nenhum registro encontrado');

    expect(result).toEqual({
      PageData: undefined,
      Items: 0,
      TotalItems: 0,
      TotalPage: 1,
      Page: 1,
      NextPage: undefined,
      PreviousPage: undefined,
      Code: 404,
      Message: 'Nenhum registro encontrado',
    });
  });

  it('deve sobrescrever os valores de paginação quando o objeto params for informado', () => {
    const data = [mockEditoraDTO];
    const params = {
      totalItems: 50,
      totalPages: 5,
      page: 2,
      nextPage: 'token-proxima-pagina',
      prevPage: 'token-pagina-anterior',
    };

    const result: PageDataType = createResult(data, 206, 'Retornando página 2', params);

    expect(result.TotalItems).toBe(50);
    expect(result.TotalPage).toBe(5);
    expect(result.Page).toBe(2);
    expect(result.NextPage).toBe('token-proxima-pagina');
    expect(result.PreviousPage).toBe('token-pagina-anterior');
    expect(result.Code).toBe(206);
    expect(result.Message).toBe('Retornando página 2');
  });

  it('deve lidar corretamente quando os dados forem um objeto único em tempo de execução', () => {
    // Usamos 'as any' para contornar a assinatura tipada e validar a branch de fallback (data ? 1 : 0)
    const result: PageDataType = createResult([mockEditoraDTO], 200, 'Objeto único');

    expect(result.PageData).toEqual([mockEditoraDTO]);
    expect(result.Items).toBe(1);
    expect(result.TotalItems).toBe(1);
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Objeto único');
  });
});
