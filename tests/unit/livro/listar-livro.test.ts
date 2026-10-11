import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import {
  ISBN,
  LivroInvalidoError,
  LogService,
  StatusLivro,
} from '@gustavoadolfo/minhoteca-core-layer';
import { ListarLivroUseCase } from '../../../layer/nodejs/src/livro';

// Realiza o mock parcial da camada core para consistência com outros testes
jest.mock('@gustavoadolfo/minhoteca-core-layer', () => {
  const actual = jest.requireActual('@gustavoadolfo/minhoteca-core-layer');
  return {
    ...actual,
    LogService: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  };
});

describe('ListarLivroUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const livroMockData = {
    id: '1cc97df5bfa64cf9b5ff44734a7e4521',
    titulo: 'Batman e Filho',
    subtitulo: 'A Lenda do Batman - Volume 1',
    isbn: '9788543908366',
    autorId: '9264cb73-1ac9-422c-a07f-26d3ba3af2ed',
    editoraId: 'd98a30cf69ba45e3ac4477877073ad9c',
    anoPublicacao: 2019,
    sinopse:
      "Quando aquela que o Batman um dia amou, Talia, filha de um dos maiores inimidos do Cavaleiro das Trevas, Ra''s Al Ghul, reaparece com um exército de Morcegos-Humanos, ela tem uma outra surpresa para o herói - seu filho. Damian Wayne foi criado com a brutal Liga dos Assassions, e seu ímpeto violento e agressivo ameaça demolir o mundo do Homem-Morcego.",
    situacao: StatusLivro.DISPONIVEL,
    revisar: false,
    autor: undefined,
    editora: undefined,
    idioma: 'Português',
    imagemCapaMiniUrl: undefined,
    imagemCapaUrl: '64a8ec23d1a011ed9aae204747fd3490.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repoMock = {
      saveData: jest.fn(),
      getAll: jest.fn(),
      getData: jest.fn(),
      queryData: jest.fn(),
      updateByMinhotecaId: jest.fn(),
      deleteByMinhotecaId: jest.fn(),
      removeData: jest.fn(),
      findByMinhotecaId: jest.fn(),
      getListByMinhotecaIds: jest.fn(),
    } as unknown as jest.Mocked<RepositoryInterface>;
  });

  const createEvent = (
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  it.each([
    ['9788556710239', '9788556710239'],
    [{ value: '9786587817644' }, '9786587817644'],
    [9788535900736, '9788535900736'],
    [8535900736, '8535900736'],
    [new ISBN('9786587817644'), '9786587817644'],
    [{ value: '978-6587817644' }, '9786587817644'],
  ])('deve listar ISBN persistido %p como string', async (isbn, esperado) => {
    repoMock.getAll.mockResolvedValueOnce({
      data: [{ ...livroMockData, isbn }],
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    repoMock.getListByMinhotecaIds.mockResolvedValueOnce({
      data: [],
      limit: 10,
      currentPage: 1,
      totalPages: 0,
      totalDocuments: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });

    const result = await new ListarLivroUseCase(repoMock).execute(createEvent());

    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([
      expect.objectContaining({ id: livroMockData.id, isbn: esperado }),
    ]);
    expect(result.TotalItems).toBe(1);
    expect(result.Page).toBe(1);
    expect(result.TotalPage).toBe(1);
    expect(repoMock.getListByMinhotecaIds).toHaveBeenCalledWith('Autores', [livroMockData.autorId]);
  });

  const createRepositoryResult = (
    data: unknown[],
    pagination: Partial<Omit<ResultType, 'data'>> = {}
  ): ResultType => ({
    data,
    limit: 10,
    currentPage: 1,
    totalPages: data.length > 0 ? 1 : 0,
    totalDocuments: data.length,
    hasNextPage: false,
    hasPrevPage: false,
    ...pagination,
  });

  it('deve converter ISBNs mistos na mesma página e associar o autor sem duplicar IDs', async () => {
    const data = [
      { ...livroMockData, id: 'livro-string', isbn: '9788556710239' },
      { ...livroMockData, id: 'livro-objeto', isbn: { value: '9786587817644' } },
      { ...livroMockData, id: 'livro-numero', isbn: 9788535900736 },
    ];
    repoMock.getAll.mockResolvedValueOnce(
      createRepositoryResult(data, {
        currentPage: 2,
        limit: 3,
        totalDocuments: 9,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      })
    );
    repoMock.getListByMinhotecaIds.mockResolvedValueOnce(
      createRepositoryResult([{ id: livroMockData.autorId, nome: 'Autor de Teste' }])
    );

    const result = await new ListarLivroUseCase(repoMock).execute(
      createEvent({ page: '2', limit: '3' })
    );

    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([
      expect.objectContaining({ id: 'livro-string', isbn: '9788556710239' }),
      expect.objectContaining({ id: 'livro-objeto', isbn: '9786587817644' }),
      expect.objectContaining({ id: 'livro-numero', isbn: '9788535900736' }),
    ]);
    result.PageData?.forEach((livro: unknown) => {
      expect(livro).toEqual(
        expect.objectContaining({
          situacao: StatusLivro.DISPONIVEL,
          autor: expect.objectContaining({ id: livroMockData.autorId, nome: 'Autor de Teste' }),
        })
      );
      expect(livro).not.toHaveProperty('status');
    });
    expect(repoMock.getListByMinhotecaIds).toHaveBeenCalledTimes(1);
    expect(repoMock.getListByMinhotecaIds).toHaveBeenCalledWith('Autores', [livroMockData.autorId]);
    expect(result.TotalItems).toBe(9);
    expect(result.Page).toBe(2);
    expect(result.TotalPage).toBe(3);
    expect(result.NextPage).toBe('?page=3&limit=3&sortBy=titulo&sortOrder=asc');
    expect(result.PreviousPage).toBe('?page=1&limit=3&sortBy=titulo&sortOrder=asc');
    expect(data[1].isbn).toEqual({ value: '9786587817644' });
  });

  it.each([
    [undefined, 'ISBN é obrigatório'],
    [null, 'Tipo ou valor de ISBN inválido.'],
    [{}, 'Tipo ou valor de ISBN inválido.'],
    [[], 'Tipo ou valor de ISBN inválido.'],
    [true, 'Tipo ou valor de ISBN inválido.'],
    [NaN, 'Tipo ou valor de ISBN inválido.'],
    [Infinity, 'Tipo ou valor de ISBN inválido.'],
    [-1, 'Tipo ou valor de ISBN inválido.'],
    [1.5, 'Tipo ou valor de ISBN inválido.'],
    [Number.MAX_SAFE_INTEGER + 1, 'Tipo ou valor de ISBN inválido.'],
    [{ value: null }, 'Tipo ou valor de ISBN inválido.'],
    [{ value: {} }, 'Tipo ou valor de ISBN inválido.'],
    ['123', 'ISBN inválido: 123. Use ISBN-10 ou ISBN-13'],
    [{ value: '123' }, 'ISBN inválido: 123. Use ISBN-10 ou ISBN-13'],
  ])('deve rejeitar ISBN inválido %p e registrar a causa real', async (isbn, message) => {
    repoMock.getAll.mockResolvedValueOnce(
      createRepositoryResult([livroMockData, { ...livroMockData, id: 'livro-invalido', isbn }])
    );

    const useCase = new ListarLivroUseCase(repoMock);
    await expect(useCase.execute(createEvent(), 'isbn-invalido')).rejects.toThrow(
      LivroInvalidoError
    );

    const log = jest.mocked(LogService).mock.results.at(-1)?.value;
    expect(log.error).toHaveBeenCalledWith(
      'Erro ao listar livros:',
      { label: 'ListarLivroUseCase', logId: 'isbn-invalido' },
      expect.objectContaining({ message }),
      { data: createEvent() }
    );
    expect(repoMock.getListByMinhotecaIds).not.toHaveBeenCalled();
  });

  it('deve listar livros com paginação padrão quando queryStringParameters é null', async () => {
    const mockResult: ResultType = {
      data: [livroMockData],
      limit: 10,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(createEvent(null), '12345');

    expect(repoMock.getAll).toHaveBeenCalledWith('Livros', {
      page: 1,
      limit: 10,
      sortBy: 'titulo',
      sortOrder: 'asc',
    });
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Livros listados com sucesso');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ titulo: 'Batman e Filho' })])
    );
  });

  it('deve usar parâmetros da query e gerar corretamente os links de next/prev page', async () => {
    const mockResult: ResultType = {
      data: [livroMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const event = createEvent({ page: '2', limit: '5', sortBy: 'titulo', sortOrder: 'desc' });
    const result = await useCase.execute(event, '12345');

    expect(repoMock.getAll).toHaveBeenCalledWith('Livros', {
      page: 2,
      limit: 5,
      sortBy: 'titulo',
      sortOrder: 'desc',
    });
    expect(result.NextPage).toBe('?page=3&limit=5&sortBy=titulo&sortOrder=desc');
    expect(result.PreviousPage).toBe('?page=1&limit=5&sortBy=titulo&sortOrder=desc');
  });

  it('deve mapear sort[campo] e filter[campo] para sortBy/sortOrder e filterKey/filterValue', async () => {
    const mockResult: ResultType = {
      data: [livroMockData],
      limit: 20,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const event = createEvent({
      page: '1',
      limit: '20',
      'sort[titulo]': 'asc',
      'filter[titulo]': 'casa',
    });

    await useCase.execute(event, '12345');

    expect(repoMock.getAll).toHaveBeenCalledWith('Livros', {
      page: 1,
      limit: 20,
      sortBy: 'titulo',
      sortOrder: 'asc',
      filterKey: 'titulo',
      filterValue: 'casa',
    });
  });

  it('deve mapear filtro por autor para autorId e preencher dados de autor no livro', async () => {
    const livroComMesmoAutor = { ...livroMockData, id: 'id-2' };

    repoMock.getAll
      .mockResolvedValueOnce({
        data: [{ id: livroMockData.autorId }],
      } as ResultType)
      .mockResolvedValueOnce({
        data: [livroMockData, livroComMesmoAutor],
        limit: 10,
        currentPage: 1,
        totalPages: 1,
        totalDocuments: 2,
        hasNextPage: false,
        hasPrevPage: false,
      } as ResultType);

    repoMock.getListByMinhotecaIds.mockResolvedValueOnce({
      data: [
        {
          id: livroMockData.autorId,
          nome: 'Autor de Teste',
          email: 'autor@teste.com',
          website: 'https://autor.teste',
          paisId: 76,
        },
      ],
    } as ResultType);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(
      createEvent({ filterKey: 'autor', filterValue: 'Autor de Teste' }),
      '12345'
    );

    expect(repoMock.getAll).toHaveBeenNthCalledWith(1, 'Autores', {
      page: 1,
      limit: 10000,
      filterKey: 'nome',
      filterValue: 'Autor de Teste',
    });
    expect(repoMock.getAll).toHaveBeenNthCalledWith(2, 'Livros', {
      page: 1,
      limit: 10,
      sortBy: 'titulo',
      sortOrder: 'asc',
      filterKey: 'autorId',
      filterValue: [livroMockData.autorId],
    });
    expect(repoMock.getListByMinhotecaIds).toHaveBeenCalledWith('Autores', [livroMockData.autorId]);
    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autorId: livroMockData.autorId,
          autor: expect.objectContaining({ id: livroMockData.autorId, nome: 'Autor de Teste' }),
        }),
      ])
    );
  });

  it('deve ordenar livros por nome do autor e respeitar a paginação', async () => {
    const livroAutorCarlos = {
      ...livroMockData,
      id: 'livro-carlos',
      titulo: 'Livro do Carlos',
      autorId: 'autor-carlos',
    };
    const livroAutorAna = {
      ...livroMockData,
      id: 'livro-ana',
      titulo: 'Livro da Ana',
      autorId: 'autor-ana',
    };
    const livroAutorBruno = {
      ...livroMockData,
      id: 'livro-bruno',
      titulo: 'Livro do Bruno',
      autorId: 'autor-bruno',
    };

    repoMock.getAll
      .mockResolvedValueOnce({
        data: [
          { id: 'autor-carlos', nome: 'Carlos' },
          { id: 'autor-ana', nome: 'Ana' },
          { id: 'autor-bruno', nome: 'Bruno' },
        ],
      } as ResultType)
      .mockResolvedValueOnce({
        data: [livroAutorCarlos, livroAutorAna, livroAutorBruno],
        limit: 10000,
        currentPage: 1,
        totalPages: 1,
        totalDocuments: 3,
        hasNextPage: false,
        hasPrevPage: false,
      } as ResultType);

    repoMock.getListByMinhotecaIds.mockResolvedValueOnce({
      data: [
        { id: 'autor-carlos', nome: 'Carlos' },
        { id: 'autor-ana', nome: 'Ana' },
        { id: 'autor-bruno', nome: 'Bruno' },
      ],
    } as ResultType);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(
      createEvent({ page: '2', limit: '1', sortBy: 'autor', sortOrder: 'asc' }),
      '12345'
    );

    expect(result.Code).toBe(200);
    expect(result.PageData).toHaveLength(1);
    expect(result.PageData![0]).toEqual(
      expect.objectContaining({
        id: 'livro-bruno',
        autor: expect.objectContaining({ nome: 'Bruno' }),
      })
    );
    expect(result.TotalItems).toBe(3);
    expect(result.TotalPage).toBe(3);
    expect(result.Page).toBe(2);
  });

  it('deve retornar 204 ao filtrar por autor quando nenhum autor for encontrado', async () => {
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(
      createEvent({ filterKey: 'autor', filterValue: 'Autor Inexistente' }),
      '12345'
    );

    expect(repoMock.getAll).toHaveBeenCalledTimes(1);
    expect(result.Code).toBe(204);
    expect(result.Message).toBe('Nenhum livro encontrado para o nome de autor informado.');
    expect(result.PageData).toEqual([]);
  });

  it.each([
    ['asc', ['ana-a', 'ana-z', 'bruno']],
    ['desc', ['bruno', 'ana-z', 'ana-a']],
  ])(
    'deve ordenar por autor em %s e desempatar pelo título antes de paginar',
    async (sortOrder, ids) => {
      const livros = [
        {
          ...livroMockData,
          id: 'ana-z',
          autorId: 'ana',
          titulo: 'Zebra',
          isbn: { value: '9786587817644' },
        },
        { ...livroMockData, id: 'bruno', autorId: 'bruno', titulo: 'Livro B', isbn: 9788535900736 },
        { ...livroMockData, id: 'ana-a', autorId: 'ana', titulo: 'Abelha' },
      ];
      const autores = [
        { id: 'ana', nome: 'Ana' },
        { id: 'bruno', nome: 'Bruno' },
      ];
      repoMock.getAll
        .mockResolvedValueOnce(createRepositoryResult(autores))
        .mockResolvedValueOnce(createRepositoryResult(livros));
      repoMock.getListByMinhotecaIds.mockResolvedValueOnce(createRepositoryResult(autores));

      const result = await new ListarLivroUseCase(repoMock).execute(
        createEvent({
          sortBy: 'autor',
          sortOrder,
          page: '1',
          limit: '2',
          filterKey: 'titulo',
          filterValue: 'a',
        })
      );

      expect(repoMock.getAll).toHaveBeenNthCalledWith(2, 'Livros', {
        page: 1,
        limit: 10000,
        filterKey: 'titulo',
        filterValue: 'a',
      });
      expect(result.PageData).toEqual(
        ids.slice(0, 2).map((id) => expect.objectContaining({ id, isbn: expect.any(String) }))
      );
      expect(result.Items).toBe(2);
      expect(result.TotalItems).toBe(3);
      expect(result.TotalPage).toBe(2);
      expect(result.NextPage).toBe(`?page=2&limit=2&sortBy=autor&sortOrder=${sortOrder}`);
      expect(result.PreviousPage).toBeUndefined();
      expect(livros.map((livro) => livro.id)).toEqual(['ana-z', 'bruno', 'ana-a']);
    }
  );

  it('deve ordenar por título quando os autores dos livros não forem encontrados', async () => {
    repoMock.getAll
      .mockResolvedValueOnce(createRepositoryResult([{}, { id: 'sem-nome' }]))
      .mockResolvedValueOnce(
        createRepositoryResult([
          { ...livroMockData, id: 'z', titulo: 'Zebra', autorId: 'desconhecido' },
          { ...livroMockData, id: 'a', titulo: 'Abelha', autorId: '' },
        ])
      );
    repoMock.getListByMinhotecaIds.mockResolvedValueOnce(createRepositoryResult([]));

    const result = await new ListarLivroUseCase(repoMock).execute(createEvent({ sortBy: 'autor' }));

    expect(result.PageData).toEqual([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'z' }),
    ]);
    expect(repoMock.getListByMinhotecaIds).toHaveBeenCalledWith('Autores', ['desconhecido']);
  });

  it.each([null, undefined, {}])(
    'deve tratar dados de ordenação ausentes ou não estruturados como %p',
    async (data) => {
      const autoresResult = createRepositoryResult([]);
      const livrosResult = createRepositoryResult([]);
      Reflect.set(autoresResult, 'data', data);
      Reflect.set(livrosResult, 'data', data);
      repoMock.getAll.mockResolvedValueOnce(autoresResult).mockResolvedValueOnce(livrosResult);

      const result = await new ListarLivroUseCase(repoMock).execute(
        createEvent({ sortBy: 'autor' })
      );

      expect(result.Code).toBe(204);
      expect(result.PageData).toEqual([]);
      expect(result.TotalItems).toBe(0);
      expect(result.TotalPage).toBe(0);
      expect(repoMock.getListByMinhotecaIds).not.toHaveBeenCalled();
    }
  );

  it('deve aplicar ordenação padrão aos links quando os parâmetros de ordenação forem vazios', async () => {
    const mockResult: ResultType = {
      data: [livroMockData],
      limit: 5,
      currentPage: 2,
      totalPages: 3,
      totalDocuments: 15,
      hasNextPage: true,
      hasPrevPage: true,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const event = createEvent({ page: '2', limit: '5', sortBy: '', sortOrder: '' });
    const result = await useCase.execute(event, '12345');

    expect(result.NextPage).toBe('?page=3&limit=5&sortBy=titulo&sortOrder=asc');
    expect(result.PreviousPage).toBe('?page=1&limit=5&sortBy=titulo&sortOrder=asc');
  });

  it('deve retornar status 204 quando não houver registros', async () => {
    const mockResult: ResultType = {
      data: [],
      limit: 10,
      currentPage: 1,
      totalPages: 0,
      totalDocuments: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(createEvent(null), '12345');

    expect(result.Code).toBe(204);
    expect(result.Message).toBe('Nenhum livro encontrado');
    expect(result.PageData).toHaveLength(0);
    expect(repoMock.getListByMinhotecaIds).not.toHaveBeenCalled();
    expect(result.TotalItems).toBe(0);
    expect(result.TotalPage).toBe(0);
    expect(result.NextPage).toBeUndefined();
    expect(result.PreviousPage).toBeUndefined();
  });

  it('deve utilizar fallbacks quando o repository realmente omitir os metadados de paginação', async () => {
    const mockResult = createRepositoryResult([
      livroMockData,
      { ...livroMockData, id: 'outro-livro' },
    ]);
    // Simula um retorno legado que não cumpre o contrato completo do repositório.
    Reflect.deleteProperty(mockResult, 'currentPage');
    Reflect.deleteProperty(mockResult, 'totalDocuments');
    Reflect.deleteProperty(mockResult, 'totalPages');
    repoMock.getAll.mockResolvedValueOnce(mockResult);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(createEvent({ page: '3' }), '12345');

    expect(result.Page).toBe(3);
    expect(result.TotalItems).toBe(2);
    expect(result.TotalPage).toBe(0);
  });

  it('deve tratar exceção de falta do id no getOwnPropertyDescriptor provendo um fallback', async () => {
    // Objeto sem a chave id para forçar `Object.getOwnPropertyDescriptor(item, 'id')` retornar undefined
    const dataSemId = {
      titulo: livroMockData.titulo,
      subtitulo: livroMockData.subtitulo,
      isbn: livroMockData.isbn,
      autorId: livroMockData.autorId,
      editoraId: livroMockData.editoraId,
      anoPublicacao: livroMockData.anoPublicacao,
    };

    repoMock.getAll.mockResolvedValueOnce({ data: [dataSemId] } as ResultType);

    const useCase = new ListarLivroUseCase(repoMock);
    const result = await useCase.execute(createEvent(null), '12345');

    expect(result.Code).toBe(200);
    expect(result.PageData).toEqual([expect.objectContaining({ id: '' })]);
  });

  it('deve utilizar o nome da tabela configurada nas variáveis de ambiente', async () => {
    const originalEnv = process.env.TABELA_LIVROS;
    process.env.TABELA_LIVROS = 'Tabela_Mock_Listar_Livros';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as ResultType);
      const useCase = new ListarLivroUseCase(repoMock);

      await useCase.execute(createEvent(null), '12345');
      expect(repoMock.getAll).toHaveBeenCalledWith('Tabela_Mock_Listar_Livros', expect.any(Object));
    } finally {
      if (originalEnv === undefined) {
        delete process.env.TABELA_LIVROS;
      } else {
        process.env.TABELA_LIVROS = originalEnv;
      }
    }
  });

  it('deve capturar e relançar erro padrão quando ocorrer uma falha', async () => {
    repoMock.getAll.mockRejectedValueOnce(new Error('Erro interno do DB'));

    const useCase = new ListarLivroUseCase(repoMock);
    await expect(useCase.execute(createEvent(null), '12345')).rejects.toThrow(
      'Falha ao listar livros.'
    );
  });
});
