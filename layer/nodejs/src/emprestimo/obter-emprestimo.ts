import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import {
  UseCaseInterface,
  PageDataType,
  LogService,
  EmprestimoDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util';

export class ObterEmprestimoUseCase implements UseCaseInterface {
  private _tabelaEmprestimoUsuario: string;
  private _tabelaEmprestimoLivros: string;
  private logService = new LogService('ObterEmprestimoUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaEmprestimoUsuario = process.env.TABELA_EMPRESTIMO_USUARIO ?? 'EmprestimoUsuario';
    this._tabelaEmprestimoLivros = process.env.TABELA_EMPRESTIMO_LIVROS ?? 'EmprestimoLivros';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterEmprestimoUseCase',
      { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const { usuarioId, livroId } = { ...data.queryStringParameters };
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        { usuarioId, livroId }
      );

      let resultEmprestimo: EmprestimoDTO = {
        usuarioId,
        livroId,
        toJSONString: () => JSON.stringify({ usuarioId, livroId }),
      } as EmprestimoDTO;

      if (usuarioId) {
        const resultEmprestimoUsuario: ResultType = await this._repository.getData(
          this._tabelaEmprestimoUsuario,
          { name: 'usuarioId', value: usuarioId, type: 'S' }
        );
        this.logService.info(
          'Resultado da consulta de empréstimo do usuário',
          { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
          { resultEmprestimoUsuario }
        );
        const dataResult = (resultEmprestimoUsuario?.data ?? {}) as EmprestimoDTO;
        if (dataResult) {
          resultEmprestimo = {
            ...dataResult,
            toJSONString: () => JSON.stringify(dataResult),
          } as EmprestimoDTO;
        }
      }

      if (livroId) {
        const resultEmprestimoLivro: ResultType = await this._repository.getData(
          this._tabelaEmprestimoLivros,
          { name: 'livroId', value: livroId, type: 'S' }
        );
        this.logService.info(
          'Resultado da consulta de empréstimo do livro',
          { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
          { resultEmprestimoLivro }
        );
        const dataResult = (resultEmprestimoLivro?.data ?? {}) as EmprestimoDTO;
        if (dataResult) {
          resultEmprestimo = {
            ...dataResult,
            toJSONString: () => JSON.stringify(dataResult),
          } as EmprestimoDTO;
        }
      }

      return createResult([resultEmprestimo], 201, 'Empréstimo criado com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar empréstimo:',
        { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new Error('Falha ao criar empréstimo.');
    }
  }
}
